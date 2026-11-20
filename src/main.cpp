#include <iostream>
#include <cstring>
#include <vector>
#include <string>
#include <filesystem>
#include <algorithm>
#include <cstdio>

#include <GLFW/glfw3.h>
#include <GL/gl.h>

#include "imgui.h"
#include "imgui_impl_glfw.h"
#include "imgui_impl_opengl3.h"

#include "mp3imgui.h"

namespace fs = std::filesystem;

static char path_buf[2048] = "";
static char folder_buf[2048] = "";
static bool show_demo = false;

static std::string run_zenity(const char* args) {
    std::string cmd = std::string("zenity ") + args + " 2>/dev/null";
    FILE* f = popen(cmd.c_str(), "r");
    if (!f) return "";
    char buf[4096];
    std::string out;
    while (fgets(buf, sizeof(buf), f)) out += buf;
    pclose(f);
    while (!out.empty() && (out.back() == '\n' || out.back() == '\r')) out.pop_back();
    return out;
}

// ---- playlist state 
static std::vector<std::string> playlist;
static int current_index = -1;
static bool repeat_all = true;
static bool repeat_one = false;
static bool shuffle = false;
static int selected = -1;
//supported file types
static const std::vector<std::string> audio_exts = {
    ".mp3", ".wav", ".ogg", ".flac", ".m4a", ".aac", ".wma"
};

static bool is_audio_file(const fs::path& p) {
    std::string ext = p.extension().string();
    std::transform(ext.begin(), ext.end(), ext.begin(), ::tolower);
    return std::find(audio_exts.begin(), audio_exts.end(), ext) != audio_exts.end();
}

static void play_index(int idx) {
    if (idx < 0 || idx >= (int)playlist.size()) return;
    current_index = idx;
    mp3::load(playlist[idx]);
    mp3::play();
}

static void next_track() {
    if (playlist.empty()) return;
    if (repeat_one) { play_index(current_index); return; }
    int n = (int)playlist.size();
    int next = current_index;
    if (shuffle) {
        if (n > 1) do { next = rand() % n; } while (next == current_index);
    } else {
        next = current_index + 1;
        if (next >= n) {
            if (repeat_all) next = 0; else { mp3::stop(); return; }
        }
    }
    play_index(next);
}

static void prev_track() {
    if (playlist.empty()) return;
    int n = (int)playlist.size();
    int prev = current_index - 1;
    if (prev < 0) prev = repeat_all ? n - 1 : 0;
    play_index(prev);
}

static void drop_callback(GLFWwindow*, int count, const char** paths) {
    for (int i = 0; i < count; i++) {
        if (!paths[i]) continue;
        fs::path p(paths[i]);
        if (fs::is_directory(p)) {
            for (auto& e : fs::recursive_directory_iterator(p)) {
                if (e.is_regular_file() && is_audio_file(e.path()))
                    playlist.push_back(e.path().string());
            }
        } else if (is_audio_file(p)) {
            playlist.push_back(p.string());
        }
    }
    if (current_index < 0 && !playlist.empty()) play_index(0);
}

void render_ui()
{
    ImGui::SetNextWindowPos(ImVec2(0.0f, 0.0f));
    ImGui::SetNextWindowSize(ImGui::GetIO().DisplaySize);

    constexpr ImGuiWindowFlags flags =
        ImGuiWindowFlags_NoResize |
        ImGuiWindowFlags_NoMove |
        ImGuiWindowFlags_NoCollapse |
        ImGuiWindowFlags_NoTitleBar;

    ImGui::Begin("Msync", nullptr, flags);

    //ImGui::Text("");
    ImGui::Separator();

    // ---- add files / folders ----
    ImGui::InputText("File", path_buf, sizeof(path_buf));
    ImGui::SameLine();
    if (ImGui::Button("Browse...##file")) {
        std::string p = run_zenity("--file-selection --title=\"Select audio file\"");
        if (!p.empty()) std::strncpy(path_buf, p.c_str(), sizeof(path_buf) - 1);
    }
    ImGui::SameLine();
    if (ImGui::Button("Add File")) {
        if (path_buf[0]) {
            playlist.push_back(path_buf);
            if (current_index < 0) play_index(0);
            path_buf[0] = '\0';
        }
    }
    ImGui::SameLine();
    if (ImGui::Button("Play File...")) {
        std::string p = run_zenity("--file-selection --title=\"Select audio file\"");
        if (!p.empty()) {
            playlist.push_back(p);
            play_index((int)playlist.size() - 1);
        }
    }
    ImGui::InputText("Folder", folder_buf, sizeof(folder_buf));
    ImGui::SameLine();
    if (ImGui::Button("Browse...##folder")) {
        std::string p = run_zenity("--file-selection --directory --title=\"Select music folder\"");
        if (!p.empty()) std::strncpy(folder_buf, p.c_str(), sizeof(folder_buf) - 1);
    }
    ImGui::SameLine();
    if (ImGui::Button("Add Folder")) {
        if (folder_buf[0]) {
            fs::path d(folder_buf);
            if (fs::is_directory(d)) {
                for (auto& e : fs::recursive_directory_iterator(d)) {
                    if (e.is_regular_file() && is_audio_file(e.path()))
                        playlist.push_back(e.path().string());
                }
                if (current_index < 0 && !playlist.empty()) play_index(0);
            }
            folder_buf[0] = '\0';
        }
    }
    ImGui::TextDisabled("Tip: drag & drop files or folders onto the window.");

    ImGui::Spacing();
    ImGui::Separator();

    // ---- now playing ----
    if (mp3::is_loaded()) {
        ImGui::Text("Now Playing: %s", mp3::title().c_str());

        double pos = mp3::position();
        double dur = mp3::duration();
        float fpos = (float)pos;
        float fdur = (float)dur;
        if (fdur <= 0.0f) fdur = 1.0f;

        if (ImGui::SliderFloat("Seek", &fpos, 0.0f, fdur, "%.1f s")) {
            mp3::seek(fpos);
        }
        ImGui::Text("Time: %.1f / %.1f s", pos, dur);

        ImGui::Spacing();

        if (mp3::is_playing()) {
            if (ImGui::Button("||")) mp3::pause();
        } else {
            if (ImGui::Button("play")) mp3::play();
        }
        ImGui::SameLine();
        if (ImGui::Button("stop")) mp3::stop();
        ImGui::SameLine();
        if (ImGui::Button("<")) prev_track();
        ImGui::SameLine();
        if (ImGui::Button(">")) next_track();

        ImGui::Spacing();
        float vol = mp3::volume();
        if (ImGui::SliderFloat("Volume", &vol, 0.0f, 1.0f)) {
            mp3::set_volume(vol);
        }

        ImGui::Checkbox("Repeat All", &repeat_all);
        ImGui::SameLine();
        ImGui::Checkbox("Repeat One", &repeat_one);
        ImGui::SameLine();
        ImGui::Checkbox("Shuffle", &shuffle);
    } else {
        ImGui::Text("N/A");
    }

    ImGui::Spacing();
    ImGui::Separator();

    // ---- playlist ----
    ImGui::Text("Playlist (%d)", (int)playlist.size());
    if (ImGui::Button("Remove Selected") && selected >= 0 && selected < (int)playlist.size()) {
        playlist.erase(playlist.begin() + selected);
        if (playlist.empty()) { current_index = -1; mp3::stop(); }
        else if (selected < current_index) current_index--;
        else if (selected == current_index) play_index(current_index < (int)playlist.size() ? current_index : 0);
        selected = -1;
    }
    ImGui::SameLine();
    if (ImGui::Button("Clear")) {
        playlist.clear();
        current_index = -1;
        mp3::stop();
        selected = -1;
    }

    float playlist_h = ImGui::GetIO().DisplaySize.y * 0.32f;
    if (playlist_h < 120.0f) playlist_h = 120.0f;
    ImGui::BeginChild("PlaylistScroll", ImVec2(0, playlist_h), true);
    for (int i = 0; i < (int)playlist.size(); i++) {
        std::string name = fs::path(playlist[i]).filename().string();
        bool is_current = (i == current_index);
        if (is_current) ImGui::PushStyleColor(ImGuiCol_Text, ImVec4(0.3f, 1.0f, 0.3f, 1.0f));
        if (ImGui::Selectable(name.c_str(), selected == i)) selected = i;
        if (is_current) ImGui::PopStyleColor();
        if (ImGui::IsItemHovered() && ImGui::IsMouseDoubleClicked(0)) play_index(i);
    }
    ImGui::EndChild();

    ImGui::Spacing();
    // ImGui::Checkbox("Show ImGui Demo", &show_demo);
    // ImGui::End();

    // if (show_demo) ImGui::ShowDemoWindow(&show_demo);

    // // ---- auto-advance ----
    // if (mp3::finished()) {
    //     mp3::clear_finished();
    //     next_track();
    // }
}

int main(int argc, char** argv)
{
    if (argc > 1) {
        std::strncpy(path_buf, argv[1], sizeof(path_buf) - 1);
        path_buf[sizeof(path_buf) - 1] = '\0';
    }

    // Force X11 backend so window decorations (title bar / resize handles) work
    // even when running under a Wayland session (avoids libdecor-gtk failure).
    glfwInitHint(GLFW_PLATFORM, GLFW_PLATFORM_X11);

    if (!glfwInit())
    {
        std::cerr << "GLFW initialization failed\n";
        return 1;
    }

    glfwWindowHint(GLFW_CONTEXT_VERSION_MAJOR, 3);
    glfwWindowHint(GLFW_CONTEXT_VERSION_MINOR, 3);
    glfwWindowHint(GLFW_OPENGL_PROFILE, GLFW_OPENGL_CORE_PROFILE);
    glfwWindowHint(GLFW_RESIZABLE, GLFW_TRUE);
    glfwWindowHint(GLFW_DECORATED, GLFW_TRUE);

    constexpr int window_width = 1280;
    constexpr int window_height = 800;

    GLFWwindow* window = glfwCreateWindow(window_width, window_height, "MP3 Player", nullptr, nullptr);
    if (window == nullptr) {
        std::cerr << "Window creation failed\n";
        glfwTerminate();
        return 1;
    }

    glfwMakeContextCurrent(window);
    glfwSwapInterval(1);
    glfwMaximizeWindow(window);
    glfwSetDropCallback(window, drop_callback);

    if (!mp3::init()) std::cerr << "Audio init failed\n";

    if (path_buf[0] != '\0') {
        playlist.push_back(path_buf);
        play_index(0);
        path_buf[0] = '\0';
    }

    IMGUI_CHECKVERSION();
    ImGui::CreateContext();
    ImGuiIO& io = ImGui::GetIO();
    (void)io;
    ImGui::StyleColorsDark();

    // DPI scaling so text/buttons aren't tiny on high-DPI displays
    float xscale = 1.0f, yscale = 1.0f;
    glfwGetWindowContentScale(window, &xscale, &yscale);
    float scale = (xscale + yscale) * 0.5f;
    if (scale < 1.0f) scale = 1.0f;
    ImGui::GetStyle().ScaleAllSizes(scale);
    io.FontGlobalScale = scale;

    ImGui_ImplGlfw_InitForOpenGL(window, true);
    ImGui_ImplOpenGL3_Init("#version 330");

    while (!glfwWindowShouldClose(window))
    {
        glfwPollEvents();
        ImGui_ImplOpenGL3_NewFrame();
        ImGui_ImplGlfw_NewFrame();
        ImGui::NewFrame();
        render_ui();
        ImGui::Render();
        int width, height;
        glfwGetFramebufferSize(window, &width, &height);
        glViewport(0, 0, width, height);
        glClearColor(0.08f, 0.08f, 0.09f, 1.0f);
        glClear(GL_COLOR_BUFFER_BIT);
        ImGui_ImplOpenGL3_RenderDrawData(ImGui::GetDrawData());
        glfwSwapBuffers(window);
    }

    ImGui_ImplOpenGL3_Shutdown();
    ImGui_ImplGlfw_Shutdown();
    ImGui::DestroyContext();
    mp3::shutdown();
    glfwDestroyWindow(window);
    glfwTerminate();
    return 0;
}
