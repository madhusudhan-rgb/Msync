#define MA_IMPLEMENTATION
#include "miniaudio.h"

#include "mp3imgui.h"

#include <cstdio>
#include <cstring>
#include <string>
#include <filesystem>

namespace {
    struct State {
        ma_device device{};
        ma_decoder decoder{};
        bool device_ready = false;
        bool loaded = false;
        bool playing = false;
        bool finished = false;
        float volume = 1.0f;
        std::string path;
    } g;

    void data_callback(ma_device* pDevice, void* pOutput, const void*, ma_uint32 frameCount) {
        auto* st = static_cast<State*>(pDevice->pUserData);
        if (!st || !st->loaded || !st->playing) {
            std::memset(pOutput, 0, frameCount * ma_get_bytes_per_frame(pDevice->playback.format, pDevice->playback.channels));
            return;
        }
        ma_uint64 framesRead = 0;
        ma_decoder_read_pcm_frames(&st->decoder, pOutput, frameCount, &framesRead);
        if (framesRead < frameCount) {
            const ma_uint32 channels = pDevice->playback.channels;
            const size_t bytesPerFrame = ma_get_bytes_per_frame(pDevice->playback.format, channels);
            std::memset(static_cast<char*>(pOutput) + framesRead * bytesPerFrame, 0,
                        (frameCount - framesRead) * bytesPerFrame);
            st->playing = false;
            st->finished = true;
        }
    }
}

namespace mp3 {

bool init() {
    ma_device_config config = ma_device_config_init(ma_device_type_playback);
    config.playback.format = ma_format_f32;
    config.playback.channels = 2;
    config.sampleRate = 44100;
    config.periodSizeInMilliseconds = 200;
    config.dataCallback = data_callback;
    config.pUserData = &g;

    if (ma_device_init(nullptr, &config, &g.device) != MA_SUCCESS) {
        std::fprintf(stderr, "miniaudio: device init failed\n");
        return false;
    }
    g.device_ready = true;
    ma_device_start(&g.device);
    return true;
}

void shutdown() {
    if (g.loaded) {
        ma_decoder_uninit(&g.decoder);
        g.loaded = false;
    }
    if (g.device_ready) {
        ma_device_uninit(&g.device);
        g.device_ready = false;
    }
}

bool load(const std::string& path) {
    if (g.loaded) {
        ma_decoder_uninit(&g.decoder);
        g.loaded = false;
    }
    g.playing = false;
    g.finished = false;

    ma_decoder_config cfg = ma_decoder_config_init(ma_format_f32, 2, 44100);
    if (ma_decoder_init_file(path.c_str(), &cfg, &g.decoder) != MA_SUCCESS) {
        std::fprintf(stderr, "miniaudio: failed to load %s\n", path.c_str());
        return false;
    }
    g.loaded = true;
    g.path = path;
    if (g.device_ready) ma_device_set_master_volume(&g.device, g.volume);
    return true;
}

void play() { if (g.loaded) { g.playing = true; g.finished = false; } }
void pause() { g.playing = false; }
void stop() { g.playing = false; if (g.loaded) ma_decoder_seek_to_pcm_frame(&g.decoder, 0); }

bool is_playing() { return g.playing; }
bool is_loaded() { return g.loaded; }
bool finished() { return g.finished; }
void clear_finished() { g.finished = false; }

double position() {
    if (!g.loaded) return 0.0;
    ma_uint64 cursor = 0;
    ma_decoder_get_cursor_in_pcm_frames(&g.decoder, &cursor);
    if (g.decoder.outputSampleRate == 0) return 0.0;
    return static_cast<double>(cursor) / static_cast<double>(g.decoder.outputSampleRate);
}

double duration() {
    if (!g.loaded) return 0.0;
    ma_uint64 len = 0;
    ma_decoder_get_length_in_pcm_frames(&g.decoder, &len);
    if (g.decoder.outputSampleRate == 0) return 0.0;
    return static_cast<double>(len) / static_cast<double>(g.decoder.outputSampleRate);
}

void seek(double seconds) {
    if (!g.loaded) return;
    if (g.decoder.outputSampleRate == 0) return;
    ma_uint64 frame = static_cast<ma_uint64>(seconds * g.decoder.outputSampleRate);
    ma_decoder_seek_to_pcm_frame(&g.decoder, frame);
}

float volume() { return g.volume; }
void set_volume(float v) { g.volume = v; if (g.device_ready) ma_device_set_master_volume(&g.device, v); }

std::string title() {
    if (g.path.empty()) return "";
    return std::filesystem::path(g.path).filename().string();
}

} // namespace mp3
