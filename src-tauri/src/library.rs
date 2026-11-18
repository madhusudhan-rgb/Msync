use std::collections::{HashMap, HashSet};
use std::fs;
use std::hash::{DefaultHasher, Hash, Hasher};
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex, OnceLock};
use std::time::{Duration, UNIX_EPOCH};

use base64::engine::general_purpose::STANDARD;
use base64::Engine;
use lofty::file::{AudioFile, TaggedFileExt};
use lofty::picture::PictureType;
use lofty::tag::Accessor;
use serde::Deserialize;
use serde::Serialize;
use tauri::Manager;
use walkdir::{DirEntry, WalkDir};

/// Extensions decoded by rodio/symphonia on every platform.
pub const AUDIO_EXTENSIONS: &[&str] = &[
    "mp3", "mp2", "mp1", "flac", "wav", "wave", "ogg", "oga", "m4a", "m4b", "aac", "alac", "aif",
    "aiff", "caf", "mka",
];

/// Extensions handed to the platform webview for video playback.
pub const VIDEO_EXTENSIONS: &[&str] = &[
    "mp4", "m4v", "webm", "mkv", "mov", "ogv", "avi", "mpg", "mpeg", "3gp", "ts", "wmv", "flv",
];

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum MediaKind {
    Audio,
    Video,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Track {
    /// Absolute path, also used as the stable identifier.
    pub id: String,
    pub path: String,
    pub title: String,
    pub artist: Option<String>,
    pub album: Option<String>,
    /// Seconds. Zero when the container does not expose a duration.
    pub duration: f64,
    pub kind: MediaKind,
    pub ext: String,
    pub size: u64,
    /// Unix timestamp in milliseconds.
    pub modified: u64,
    pub track: Option<u32>,
    pub disc: Option<u32>,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SavedLibrary {
    #[serde(default)]
    pub library: Vec<Track>,
    #[serde(default)]
    pub folders: Vec<String>,
    #[serde(default)]
    pub loose_files: Vec<String>,
    #[serde(default)]
    pub current_id: Option<String>,
    #[serde(default)]
    pub detail: Option<String>,
    #[serde(default)]
    pub volume: Option<f32>,
    #[serde(default)]
    pub muted: Option<bool>,
    #[serde(default)]
    pub shuffle: Option<bool>,
    #[serde(default)]
    pub repeat: Option<String>,
    #[serde(default)]
    pub view: Option<String>,
}

#[derive(Default)]
pub struct LibraryState {
    art_cache: Arc<Mutex<HashMap<String, Option<String>>>>,
    initial_paths: Vec<String>,
}

impl LibraryState {
    pub fn new() -> Self {
        let initial_paths = std::env::args()
            .skip(1)
            .filter(|argument| !argument.starts_with('-'))
            .collect();
        Self {
            art_cache: Arc::new(Mutex::new(HashMap::new())),
            initial_paths,
        }
    }
}

fn is_hidden(entry: &DirEntry) -> bool {
    entry
        .file_name()
        .to_str()
        .map(|name| name.starts_with('.'))
        .unwrap_or(false)
}

fn media_kind(ext: &str) -> Option<MediaKind> {
    if AUDIO_EXTENSIONS.contains(&ext) {
        Some(MediaKind::Audio)
    } else if VIDEO_EXTENSIONS.contains(&ext) {
        Some(MediaKind::Video)
    } else {
        None
    }
}

fn clean(value: Option<std::borrow::Cow<'_, str>>) -> Option<String> {
    value
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty())
}

fn track_from_path(path: &Path) -> Option<Track> {
    let ext = path
        .extension()
        .and_then(|ext| ext.to_str())
        .map(|ext| ext.to_ascii_lowercase())?;
    let kind = media_kind(&ext)?;

    let metadata = fs::metadata(path).ok()?;
    if !metadata.is_file() {
        return None;
    }

    let file_stem = path
        .file_stem()
        .map(|stem| stem.to_string_lossy().to_string())
        .unwrap_or_else(|| "Unknown track".to_string());

    let mut title = file_stem;
    let mut artist = None;
    let mut album = None;
    let mut duration = 0.0;
    let mut track = None;
    let mut disc = None;

    if let Ok(tagged) = lofty::read_from_path(path) {
        duration = tagged.properties().duration().as_secs_f64();
        if let Some(tag) = tagged.primary_tag().or_else(|| tagged.first_tag()) {
            if let Some(value) = clean(tag.title()) {
                title = value;
            }
            artist = clean(tag.artist());
            album = clean(tag.album());
            track = tag.track();
            disc = tag.disk();
        }
    }

    let modified = metadata
        .modified()
        .ok()
        .and_then(|time| time.duration_since(UNIX_EPOCH).ok())
        .map(|since| since.as_millis() as u64)
        .unwrap_or(0);

    Some(Track {
        id: path.to_string_lossy().to_string(),
        path: path.to_string_lossy().to_string(),
        title,
        artist,
        album,
        duration,
        kind,
        ext,
        size: metadata.len(),
        modified,
        track,
        disc,
    })
}

fn scan(paths: &[String]) -> Vec<Track> {
    let mut tracks = Vec::new();
    let mut seen: HashSet<PathBuf> = HashSet::new();

    for raw in paths {
        let root = PathBuf::from(raw);
        if root.is_dir() {
            for entry in WalkDir::new(&root)
                .follow_links(false)
                .into_iter()
                .filter_entry(|entry| !is_hidden(entry))
                .filter_map(Result::ok)
            {
                if !entry.file_type().is_file() {
                    continue;
                }
                let path = entry.into_path();
                if seen.insert(path.clone()) {
                    if let Some(track) = track_from_path(&path) {
                        tracks.push(track);
                    }
                }
            }
        } else if root.is_file() && seen.insert(root.clone()) {
            if let Some(track) = track_from_path(&root) {
                tracks.push(track);
            }
        }
    }

    tracks.sort_by(|a, b| {
        a.artist
            .as_deref()
            .unwrap_or("")
            .to_lowercase()
            .cmp(&b.artist.as_deref().unwrap_or("").to_lowercase())
            .then_with(|| {
                a.album
                    .as_deref()
                    .unwrap_or("")
                    .to_lowercase()
                    .cmp(&b.album.as_deref().unwrap_or("").to_lowercase())
            })
            .then_with(|| a.disc.unwrap_or(1).cmp(&b.disc.unwrap_or(1)))
            .then_with(|| {
                a.track
                    .unwrap_or(u32::MAX)
                    .cmp(&b.track.unwrap_or(u32::MAX))
            })
            .then_with(|| a.title.to_lowercase().cmp(&b.title.to_lowercase()))
    });

    tracks
}

fn encode_picture(data: &[u8], fallback_mime: Option<&str>) -> Option<String> {
    if data.is_empty() || data.len() > 25 * 1024 * 1024 {
        return None;
    }

    if let Ok(image) = image::load_from_memory(data) {
        let thumbnail = image.thumbnail(640, 640).to_rgb8();
        let mut out = Vec::new();
        let mut encoder = image::codecs::jpeg::JpegEncoder::new_with_quality(&mut out, 85);
        if encoder
            .encode(
                thumbnail.as_raw(),
                thumbnail.width(),
                thumbnail.height(),
                image::ExtendedColorType::Rgb8,
            )
            .is_ok()
        {
            return Some(format!("data:image/jpeg;base64,{}", STANDARD.encode(out)));
        }
    }

    let mime = fallback_mime.unwrap_or("image/jpeg");
    Some(format!("data:{mime};base64,{}", STANDARD.encode(data)))
}

/// Artwork files commonly shipped next to an album's tracks.
const COVER_NAMES: &[&str] = &[
    "cover",
    "folder",
    "front",
    "album",
    "albumart",
    "albumartsmall",
    "artwork",
    "art",
];

fn image_extension(path: &Path) -> bool {
    path.extension()
        .and_then(|ext| ext.to_str())
        .map(|ext| {
            matches!(
                ext.to_ascii_lowercase().as_str(),
                "jpg" | "jpeg" | "png" | "webp" | "bmp" | "gif"
            )
        })
        .unwrap_or(false)
}

fn embedded_art(path: &Path) -> Option<String> {
    let tagged = lofty::read_from_path(path).ok()?;
    let mut fallback = None;

    for tag in tagged.tags() {
        for picture in tag.pictures() {
            let encoded = encode_picture(
                picture.data(),
                picture.mime_type().map(|mime| mime.as_str()),
            );
            if encoded.is_none() {
                continue;
            }
            if picture.pic_type() == PictureType::CoverFront {
                return encoded;
            }
            if fallback.is_none() {
                fallback = encoded;
            }
        }
    }

    fallback
}

/// Cover images stored beside the track (`cover.jpg`, `folder.png`, ...).
fn folder_art(path: &Path) -> Option<String> {
    let dir = path.parent()?;
    let mut candidates: Vec<PathBuf> = Vec::new();

    for entry in fs::read_dir(dir).ok()?.flatten() {
        let candidate = entry.path();
        if !candidate.is_file() || candidate == path || !image_extension(&candidate) {
            continue;
        }
        let stem = candidate
            .file_stem()
            .and_then(|stem| stem.to_str())
            .map(|stem| stem.to_ascii_lowercase())
            .unwrap_or_default();
        let expected_cover = path
            .file_stem()
            .and_then(|stem| stem.to_str())
            .and_then(|stem| stem.split('-').next())
            .map(|hash| format!("{}-cover", hash));
        if COVER_NAMES.contains(&stem.as_str())
            || expected_cover
                .as_deref()
                .map(|expected| expected == stem)
                .unwrap_or(false)
        {
            candidates.push(candidate);
        }
    }

    candidates.sort();
    candidates.iter().find_map(|candidate| {
        fs::read(candidate)
            .ok()
            .and_then(|bytes| encode_picture(&bytes, None))
    })
}

fn local_art(path: &Path) -> Option<String> {
    embedded_art(path).or_else(|| folder_art(path))
}

fn art_for(path: &str, cache: &Mutex<HashMap<String, Option<String>>>) -> Option<String> {
    if let Ok(cache) = cache.lock() {
        if let Some(cached) = cache.get(path) {
            return cached.clone();
        }
    }

    let result = local_art(Path::new(path));

    if let Ok(mut cache) = cache.lock() {
        // Keep memory bounded for very large libraries.
        if cache.len() > 600 {
            cache.clear();
        }
        cache.insert(path.to_string(), result.clone());
    }

    result
}

/* ------------------------------------------------------------------ */
/* Online artwork                                                      */
/* ------------------------------------------------------------------ */

static HTTP: OnceLock<Option<reqwest::blocking::Client>> = OnceLock::new();
static ONLINE_LOCK: Mutex<()> = Mutex::new(());

fn http_client() -> Option<&'static reqwest::blocking::Client> {
    HTTP.get_or_init(|| {
        reqwest::blocking::Client::builder()
            .timeout(Duration::from_secs(6))
            .user_agent(concat!("Musicplayer/", env!("CARGO_PKG_VERSION")))
            .build()
            .ok()
    })
    .as_ref()
}

fn normalize_name(value: &str) -> String {
    value
        .to_lowercase()
        .chars()
        .filter(|character| character.is_alphanumeric())
        .collect()
}

/// Loose match so "Album (Deluxe Edition)" still matches "Album".
fn names_related(left: &str, right: &str) -> bool {
    let left = normalize_name(left);
    let right = normalize_name(right);
    if left.is_empty() || right.is_empty() {
        return false;
    }
    left == right || left.contains(&right) || right.contains(&left)
}

fn cache_key(artist: &str, album: &str) -> String {
    let mut hasher = DefaultHasher::new();
    format!("{}\u{1f}{}", normalize_name(artist), normalize_name(album)).hash(&mut hasher);
    format!("{:016x}", hasher.finish())
}

fn fetch_bytes(url: &str) -> Result<Option<Vec<u8>>, ()> {
    let client = http_client().ok_or(())?;
    let response = client.get(url).send().map_err(|_| ())?;
    if !response.status().is_success() {
        return Err(());
    }
    if response.content_length().unwrap_or(0) > 12 * 1024 * 1024 {
        return Ok(None);
    }
    let bytes = response.bytes().map_err(|_| ())?;
    if bytes.is_empty() || bytes.len() > 12 * 1024 * 1024 {
        return Ok(None);
    }
    Ok(Some(bytes.to_vec()))
}

#[derive(Deserialize)]
struct DeezerSearch {
    data: Vec<DeezerAlbum>,
}

#[derive(Deserialize)]
struct DeezerAlbum {
    title: String,
    artist: DeezerArtist,
    cover_xl: String,
}

#[derive(Deserialize)]
struct DeezerArtist {
    name: String,
}

fn lookup_deezer(artist: &str, album: &str) -> Result<Option<String>, ()> {
    let client = http_client().ok_or(())?;
    let query = if artist.is_empty() {
        album.to_string()
    } else {
        format!("{artist} {album}")
    };
    let response = client
        .get("https://api.deezer.com/search/album")
        .query(&[("q", query), ("limit", "8".to_string())])
        .send()
        .map_err(|_| ())?;
    if !response.status().is_success() {
        return Err(());
    }
    let payload: DeezerSearch = response.json().map_err(|_| ())?;

    let best = payload.data.into_iter().find(|item| {
        names_related(album, &item.title)
            && (artist.is_empty() || names_related(artist, &item.artist.name))
    });

    let Some(item) = best else {
        return Ok(None);
    };
    let url = match item.cover_xl.as_str() {
        "" => return Ok(None),
        url => url,
    };
    Ok(fetch_bytes(url)?.and_then(|bytes| encode_picture(&bytes, None)))
}

#[derive(Deserialize)]
struct ITunesSearch {
    results: Vec<ITunesAlbum>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct ITunesAlbum {
    collection_name: String,
    artist_name: String,
    artwork_url100: String,
}

fn lookup_itunes(artist: &str, album: &str) -> Result<Option<String>, ()> {
    let client = http_client().ok_or(())?;
    let term = if artist.is_empty() {
        album.to_string()
    } else {
        format!("{artist} {album}")
    };
    let response = client
        .get("https://itunes.apple.com/search")
        .query(&[
            ("term", term),
            ("entity", "album".to_string()),
            ("limit", "8".to_string()),
        ])
        .send()
        .map_err(|_| ())?;
    if !response.status().is_success() {
        return Err(());
    }
    let payload: ITunesSearch = response.json().map_err(|_| ())?;

    let best = payload.results.into_iter().find(|item| {
        names_related(album, &item.collection_name)
            && (artist.is_empty() || names_related(artist, &item.artist_name))
    });

    let Some(item) = best else {
        return Ok(None);
    };
    let url = item
        .artwork_url100
        .replace("100x100", "600x600")
        .replace("100x100bb", "600x600bb");
    if url.is_empty() {
        return Ok(None);
    }
    Ok(fetch_bytes(&url)?.and_then(|bytes| encode_picture(&bytes, None)))
}

fn read_names(path: &Path) -> (String, String) {
    let Ok(tagged) = lofty::read_from_path(path) else {
        return (String::new(), String::new());
    };
    let Some(tag) = tagged.primary_tag().or_else(|| tagged.first_tag()) else {
        return (String::new(), String::new());
    };
    (
        clean(tag.artist()).unwrap_or_default(),
        clean(tag.album()).unwrap_or_default(),
    )
}

/// Looks artwork up on the internet for tracks without embedded or local art.
/// Results (including "nothing found") are cached on disk so a library is only
/// queried once.
fn online_art(path: &str, cache_dir: &Path) -> Option<String> {
    let (artist, album) = read_names(Path::new(path));
    if album.is_empty() {
        return None;
    }

    let key = cache_key(&artist, &album);
    let art_file = cache_dir.join(format!("{key}.art"));
    let miss_file = cache_dir.join(format!("{key}.none"));

    if let Ok(cached) = fs::read_to_string(&art_file) {
        return Some(cached);
    }
    if miss_file.exists() {
        return None;
    }

    // Serialise lookups: the UI asks for every visible row at once, and the
    // public services rate-limit bursts.
    let _guard = ONLINE_LOCK.lock().ok()?;

    if let Ok(cached) = fs::read_to_string(&art_file) {
        return Some(cached);
    }
    if miss_file.exists() {
        return None;
    }

    let deezer = lookup_deezer(&artist, &album);
    let mut answered = false;
    let mut found = match deezer {
        Ok(art) => {
            answered = true;
            art
        }
        Err(()) => None,
    };

    if found.is_none() {
        match lookup_itunes(&artist, &album) {
            Ok(art) => {
                answered = true;
                found = art;
            }
            Err(()) => {}
        }
    }

    if let Some(art) = &found {
        let _ = fs::create_dir_all(cache_dir);
        if fs::write(&art_file, art).is_err() {
            log::warn!("Could not cache artwork for {artist} - {album}");
        }
        log::info!("Fetched artwork for {artist} - {album}");
        return Some(art.clone());
    }

    // Only remember the miss when at least one service answered; otherwise a
    // temporary network failure would permanently hide artwork.
    if answered {
        let _ = fs::create_dir_all(cache_dir);
        let _ = fs::write(&miss_file, b"");
        log::info!("No artwork found for {artist} - {album}");
    }

    None
}

#[tauri::command]
pub fn initial_paths(state: tauri::State<'_, LibraryState>) -> Vec<String> {
    state.initial_paths.clone()
}

fn saved_library_file(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    app.path()
        .app_data_dir()
        .map(|dir| dir.join("library.json"))
        .map_err(|err| format!("Could not locate the app data folder: {err}"))
}

/// Debounced saves can overlap; serialize the write so the temp file never
/// gets renamed by two threads at once.
static SAVE_LOCK: std::sync::Mutex<()> = std::sync::Mutex::new(());

#[tauri::command]
pub fn load_saved_library(app: tauri::AppHandle) -> Option<SavedLibrary> {
    let file = saved_library_file(&app).ok()?;
    let raw = fs::read_to_string(file).ok()?;
    let mut saved: SavedLibrary = serde_json::from_str(&raw).ok()?;
    // Drop entries whose local file has disappeared (moved/deleted by the user).
    saved
        .library
        .retain(|track| Path::new(&track.path).is_file());
    if let Some(id) = &saved.current_id {
        if !saved.library.iter().any(|track| &track.id == id) {
            saved.current_id = None;
        }
    }
    Some(saved)
}

#[tauri::command]
pub fn save_saved_library(app: tauri::AppHandle, snapshot: SavedLibrary) -> Result<(), String> {
    let _guard = SAVE_LOCK
        .lock()
        .map_err(|_| "Save lock poisoned".to_string())?;
    let file = saved_library_file(&app)?;
    if let Some(parent) = file.parent() {
        fs::create_dir_all(parent)
            .map_err(|err| format!("Could not create {}: {err}", parent.display()))?;
    }

    let json = serde_json::to_vec(&snapshot)
        .map_err(|err| format!("Could not encode the library: {err}"))?;
    let temp = file.with_extension("json.tmp");
    fs::write(&temp, json).map_err(|err| format!("Could not write {}: {err}", temp.display()))?;
    // Windows refuses to rename over an existing file.
    let _ = fs::remove_file(&file);
    fs::rename(&temp, &file).map_err(|err| format!("Could not save {}: {err}", file.display()))?;
    Ok(())
}

#[tauri::command]
pub async fn scan_paths(paths: Vec<String>) -> Result<Vec<Track>, String> {
    if paths.is_empty() {
        return Ok(Vec::new());
    }

    tauri::async_runtime::spawn_blocking(move || {
        let tracks = scan(&paths);
        let audio = tracks
            .iter()
            .filter(|track| track.kind == MediaKind::Audio)
            .count();
        log::info!(
            "Scanned {} location(s): {} audio, {} video",
            paths.len(),
            audio,
            tracks.len() - audio
        );
        tracks
    })
    .await
    .map_err(|err| format!("Could not scan media: {err}"))
}

#[tauri::command]
pub async fn import_paths(app: tauri::AppHandle, paths: Vec<String>) -> Result<Vec<Track>, String> {
    if paths.is_empty() {
        return Ok(Vec::new());
    }

    tauri::async_runtime::spawn_blocking(move || {
        let media_dir = app
            .path()
            .app_data_dir()
            .map_err(|err| format!("Could not locate app data: {err}"))?
            .join("media");
        fs::create_dir_all(&media_dir)
            .map_err(|err| format!("Could not create media folder: {err}"))?;

        let mut imported = Vec::new();
        let mut seen: HashSet<PathBuf> = HashSet::new();

        for raw in paths {
            let root = PathBuf::from(&raw);
            let files: Vec<PathBuf> = if root.is_dir() {
                WalkDir::new(&root)
                    .follow_links(false)
                    .into_iter()
                    .filter_entry(|entry| !is_hidden(entry))
                    .filter_map(Result::ok)
                    .filter(|entry| entry.file_type().is_file())
                    .map(|entry| entry.into_path())
                    .collect()
            } else if root.is_file() {
                vec![root]
            } else {
                Vec::new()
            };

            for source in files {
                if !seen.insert(source.clone()) || !is_media_file(&source) {
                    continue;
                }

                // Already inside our library folder: reuse it as-is.
                if source.starts_with(&media_dir) {
                    if let Some(track) = track_from_path(&source) {
                        imported.push(track);
                    }
                    continue;
                }

                let destination = local_media_path(&media_dir, &source);
                if !destination.exists() {
                    fs::copy(&source, &destination)
                        .map_err(|err| format!("Could not copy {}: {err}", source.display()))?;
                    copy_folder_art(&source, &destination);
                }

                // Keep the original file name and tags as the display metadata, but
                // store the local copy as the playable path.
                if let Some(mut track) = track_from_path(&source) {
                    track.id = destination.to_string_lossy().to_string();
                    track.path = destination.to_string_lossy().to_string();
                    if let Ok(metadata) = fs::metadata(&destination) {
                        track.size = metadata.len();
                        track.modified = metadata
                            .modified()
                            .ok()
                            .and_then(|time| time.duration_since(UNIX_EPOCH).ok())
                            .map(|since| since.as_millis() as u64)
                            .unwrap_or(track.modified);
                    }
                    imported.push(track);
                }
            }
        }

        let audio = imported
            .iter()
            .filter(|track| track.kind == MediaKind::Audio)
            .count();
        log::info!(
            "Imported {} file(s) into the local library: {} audio, {} video",
            imported.len(),
            audio,
            imported.len() - audio
        );
        Ok(imported)
    })
    .await
    .map_err(|err| format!("Could not import media: {err}"))?
}

/// Stable local filename: original name plus a hash of the absolute source
/// path, so re-adding a folder reuses the same copies.
fn local_media_path(media_dir: &Path, source: &Path) -> PathBuf {
    let hash = media_hash(source);
    let name = source
        .file_name()
        .unwrap_or_default()
        .to_string_lossy()
        .into_owned();
    media_dir.join(format!("{hash}-{name}"))
}

fn media_hash(source: &Path) -> String {
    let key = source
        .canonicalize()
        .unwrap_or_else(|_| source.to_path_buf())
        .to_string_lossy()
        .into_owned();
    let mut hasher = DefaultHasher::new();
    key.hash(&mut hasher);
    format!("{:016x}", hasher.finish())
}

fn copy_folder_art(source: &Path, destination: &Path) {
    let Some(dir) = source.parent() else { return };
    let Some(dest_dir) = destination.parent() else {
        return;
    };
    let Ok(entries) = fs::read_dir(dir) else {
        return;
    };

    for entry in entries.flatten() {
        let candidate = entry.path();
        if !candidate.is_file() || !image_extension(&candidate) {
            continue;
        }
        let stem = candidate
            .file_stem()
            .and_then(|stem| stem.to_str())
            .unwrap_or_default()
            .to_ascii_lowercase();
        if !COVER_NAMES.contains(&stem.as_str()) {
            continue;
        }
        let hash = media_hash(&source);
        let ext = candidate
            .extension()
            .and_then(|ext| ext.to_str())
            .unwrap_or("jpg");
        let target = dest_dir.join(format!("{hash}-cover.{ext}"));
        if !target.exists() {
            let _ = fs::copy(&candidate, &target);
        }
        break;
    }
}

fn is_media_file(path: &Path) -> bool {
    path.extension()
        .and_then(|ext| ext.to_str())
        .map(|ext| {
            let ext = ext.to_ascii_lowercase();
            AUDIO_EXTENSIONS.contains(&ext.as_str()) || VIDEO_EXTENSIONS.contains(&ext.as_str())
        })
        .unwrap_or(false)
}

#[tauri::command]
pub async fn media_data_url(path: String) -> Result<String, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let file = PathBuf::from(&path);
        let size = fs::metadata(&file)
            .map_err(|err| format!("Could not read video: {err}"))?
            .len();
        if size > 120 * 1024 * 1024 {
            return Err("Video is too large for the in-memory fallback player".into());
        }
        let bytes = fs::read(&file).map_err(|err| format!("Could not read video: {err}"))?;
        let mime = match file
            .extension()
            .and_then(|ext| ext.to_str())
            .unwrap_or("")
            .to_ascii_lowercase()
            .as_str()
        {
            "mp4" | "m4v" => "video/mp4",
            "webm" => "video/webm",
            "mkv" => "video/x-matroska",
            "mov" => "video/quicktime",
            "ogv" => "video/ogg",
            "avi" => "video/x-msvideo",
            _ => "application/octet-stream",
        };
        Ok(format!("data:{mime};base64,{}", STANDARD.encode(bytes)))
    })
    .await
    .map_err(|err| format!("Could not read video: {err}"))?
}

#[tauri::command]
pub fn clear_art_cache(
    state: tauri::State<'_, LibraryState>,
    app: tauri::AppHandle,
) -> Result<(), String> {
    if let Ok(mut cache) = state.art_cache.lock() {
        cache.clear();
    }
    if let Some(dir) = app
        .path()
        .app_cache_dir()
        .ok()
        .map(|dir| dir.join("artwork"))
    {
        let _ = fs::remove_dir_all(dir);
    }
    Ok(())
}
#[tauri::command]
pub async fn track_art(
    path: String,
    state: tauri::State<'_, LibraryState>,
    app: tauri::AppHandle,
) -> Result<Option<String>, String> {
    let cache = Arc::clone(&state.art_cache);
    let cache_dir = app
        .path()
        .app_cache_dir()
        .ok()
        .map(|dir| dir.join("artwork"));

    tauri::async_runtime::spawn_blocking(move || {
        if let Some(art) = art_for(&path, &cache) {
            return Some(art);
        }
        cache_dir.and_then(|dir| online_art(&path, &dir))
    })
    .await
    .map_err(|err| format!("Could not read artwork: {err}"))
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Set MUSICPLAYER_TEST_MEDIA to a folder with known files to run this.
    #[test]
    fn scans_tags_artwork_and_kinds() {
        let Some(dir) = std::env::var_os("MUSICPLAYER_TEST_MEDIA") else {
            eprintln!("skipping library test: MUSICPLAYER_TEST_MEDIA is not set");
            return;
        };
        let dir = PathBuf::from(dir);
        let tracks = scan(&[dir.to_string_lossy().to_string()]);
        assert!(tracks.len() >= 5, "expected media in {dir:?}: {tracks:#?}");

        let mp3 = tracks
            .iter()
            .find(|track| track.ext == "mp3")
            .expect("mp3 track");
        assert_eq!(mp3.title, "Neon Skyline");
        assert_eq!(mp3.artist.as_deref(), Some("Aurora Field"));
        assert_eq!(mp3.album.as_deref(), Some("Midnight Drive"));
        assert_eq!(mp3.track, Some(1));
        assert_eq!(mp3.kind, MediaKind::Audio);
        assert!(
            (mp3.duration - 18.0).abs() < 0.5,
            "mp3 duration was {}",
            mp3.duration
        );

        let flac = tracks
            .iter()
            .find(|track| track.ext == "flac")
            .expect("flac track");
        assert_eq!(flac.title, "Glass Horizon");
        assert_eq!(flac.track, Some(2));
        assert!(
            (flac.duration - 15.0).abs() < 0.5,
            "flac duration was {}",
            flac.duration
        );

        let video = tracks
            .iter()
            .find(|track| track.ext == "mp4")
            .expect("mp4 track");
        assert_eq!(video.kind, MediaKind::Video);

        // Cover art is extracted from ID3 (mp3) and attached pictures (flac).
        for path in [&mp3.path, &flac.path] {
            let art = art_for(path, &Mutex::new(HashMap::new()));
            let art = art.expect("embedded cover art");
            assert!(art.starts_with("data:image/"), "unexpected art prefix");
        }
    }

    /// Set MUSICPLAYER_TEST_ONLINE=1 to check the public artwork lookup.
    #[test]
    fn fetches_online_artwork() {
        if std::env::var_os("MUSICPLAYER_TEST_ONLINE").is_none() {
            eprintln!("skipping online artwork test: MUSICPLAYER_TEST_ONLINE is not set");
            return;
        }

        let art = lookup_deezer("Daft Punk", "Discovery")
            .expect("Deezer request")
            .expect("cover art for Discovery");
        assert!(art.starts_with("data:image/"), "unexpected art prefix");
    }
}

#[cfg(test)]
mod artwork_debug4 {
    use super::*;

    #[test]
    fn debug_artwork_still() {
        let path = "/home/mt/.local/share/com.musicplayer.app/media/ab29d7e7518a6493-still love you (Slowed).mp3";
        println!(
            "STILL_ART={:?}",
            local_art(std::path::Path::new(path)).map(|s| s.chars().take(32).collect::<String>())
        );
    }
}
