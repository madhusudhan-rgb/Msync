#pragma once

#include <string>

namespace mp3 {
    bool init();
    void shutdown();

    bool load(const std::string& path);
    void play();
    void pause();
    void stop();

    bool is_playing();
    bool is_loaded();
    bool is_loading();
    bool finished();     // true when current track reached end
    void clear_finished();

    double position();   // seconds
    double duration();   // seconds
    void seek(double seconds);

    float volume();
    void set_volume(float v);

    std::string title(); // basename of loaded file
}
