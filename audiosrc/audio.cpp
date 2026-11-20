#define MA_IMPLEMENTATION
#include "miniaudio.h"

#include "mp3imgui.h"

#include <cstdio>
#include <cstring>
#include <string>
#include <vector>
#include <filesystem>
#include <atomic>
#include <thread>
#include <mutex>

namespace {
    struct State {
        ma_device device{};
        bool device_ready = false;

        std::vector<float> pcm;
        std::mutex pcm_mutex;
        ma_uint32 sample_rate = 44100;
        ma_uint32 channels = 2;
        std::atomic<ma_uint64> cursor{0};
        ma_uint64 total_frames = 0;

        bool loaded = false;
        std::atomic<bool> loading{false};
        bool playing = false;
        bool finished = false;
        float volume = 1.0f;
        std::string path;

        std::thread load_thread;
    } g;

    void data_callback(ma_device* pDevice, void* pOutput, const void*, ma_uint32 frameCount) {
        auto* st = static_cast<State*>(pDevice->pUserData);
        if (!st || !st->loaded || !st->playing) {
            std::memset(pOutput, 0, frameCount * ma_get_bytes_per_frame(pDevice->playback.format, pDevice->playback.channels));
            return;
        }

        std::lock_guard<std::mutex> lock(st->pcm_mutex);
        if (st->pcm.empty()) {
            std::memset(pOutput, 0, frameCount * ma_get_bytes_per_frame(pDevice->playback.format, pDevice->playback.channels));
            return;
        }

        const ma_uint64 remaining = (st->cursor < st->total_frames) ? (st->total_frames - st->cursor) : 0;
        const ma_uint64 toRead = (frameCount < remaining) ? frameCount : remaining;

        if (toRead > 0) {
            std::memcpy(pOutput,
                        st->pcm.data() + st->cursor * st->channels,
                        toRead * st->channels * sizeof(float));
            st->cursor += toRead;
        }

        if (toRead < frameCount) {
            const size_t bytesPerFrame = ma_get_bytes_per_frame(pDevice->playback.format, pDevice->playback.channels);
            std::memset(static_cast<char*>(pOutput) + toRead * bytesPerFrame, 0,
                        (frameCount - toRead) * bytesPerFrame);
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
    config.periodSizeInMilliseconds = 100;
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
    g.playing = false;
    if (g.load_thread.joinable()) g.load_thread.join();
    g.pcm.clear();
    g.loaded = false;
    if (g.device_ready) {
        ma_device_uninit(&g.device);
        g.device_ready = false;
    }
}

bool load(const std::string& path) {
    // Stop current
    g.playing = false;
    g.finished = false;
    if (g.load_thread.joinable()) g.load_thread.join();

    g.loaded = false;
    g.loading = true;
    g.path = path;

    g.load_thread = std::thread([path]() {
        ma_decoder_config cfg = ma_decoder_config_init(ma_format_f32, 2, 44100);
        ma_decoder decoder;
        if (ma_decoder_init_file(path.c_str(), &cfg, &decoder) != MA_SUCCESS) {
            std::fprintf(stderr, "miniaudio: failed to load %s\n", path.c_str());
            g.loading = false;
            return;
        }

        std::vector<float> pcm;
        pcm.reserve(1 << 20);
        const size_t chunk_frames = 4096;
        std::vector<float> chunk(chunk_frames * 2);
        for (;;) {
            ma_uint64 got = 0;
            ma_result r = ma_decoder_read_pcm_frames(&decoder, chunk.data(), chunk_frames, &got);
            if (got > 0) {
                pcm.insert(pcm.end(), chunk.data(), chunk.data() + got * 2);
            }
            if (r != MA_SUCCESS || got == 0) break;
        }

        ma_uint32 sr = decoder.outputSampleRate;
        if (sr == 0) sr = 44100;
        ma_uint32 ch = decoder.outputChannels;
        if (ch == 0) ch = 2;
        ma_decoder_uninit(&decoder);

        if (pcm.empty()) {
            std::fprintf(stderr, "miniaudio: empty decode %s\n", path.c_str());
            g.loading = false;
            return;
        }

        {
            std::lock_guard<std::mutex> lock(g.pcm_mutex);
            g.pcm.swap(pcm);
            g.sample_rate = sr;
            g.channels = ch;
            g.total_frames = g.pcm.size() / g.channels;
            g.cursor = 0;
        }
        g.loaded = true;
        g.loading = false;
        if (g.device_ready) ma_device_set_master_volume(&g.device, g.volume);
    });

    return true;
}

void play() { if (g.loaded) { g.playing = true; g.finished = false; } }
void pause() { g.playing = false; }
void stop() { g.playing = false; g.cursor = 0; }

bool is_playing() { return g.playing; }
bool is_loaded() { return g.loaded; }
bool is_loading() { return g.loading.load(); }
bool finished() { return g.finished; }
void clear_finished() { g.finished = false; }

double position() {
    if (!g.loaded || g.sample_rate == 0) return 0.0;
    return static_cast<double>(g.cursor.load()) / static_cast<double>(g.sample_rate);
}

double duration() {
    if (!g.loaded || g.sample_rate == 0) return 0.0;
    std::lock_guard<std::mutex> lock(g.pcm_mutex);
    return static_cast<double>(g.total_frames) / static_cast<double>(g.sample_rate);
}

void seek(double seconds) {
    if (!g.loaded) return;
    if (g.sample_rate == 0) return;
    std::lock_guard<std::mutex> lock(g.pcm_mutex);
    ma_uint64 frame = static_cast<ma_uint64>(seconds * g.sample_rate);
    if (frame > g.total_frames) frame = g.total_frames;
    g.cursor = frame;
}

float volume() { return g.volume; }
void set_volume(float v) { g.volume = v; if (g.device_ready) ma_device_set_master_volume(&g.device, v); }

std::string title() {
    if (g.path.empty()) return "";
    return std::filesystem::path(g.path).filename().string();
}

} // namespace mp3
