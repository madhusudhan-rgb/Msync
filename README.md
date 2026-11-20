# Msync

A music player application built with Dear ImGui, OpenGL, and GLFW. It provides a minimalistic audio playback interface with a custom UI built using the ImGui framework.

## Features

- Audio playback controls (Play, Pause)
- Track visualization
- Modern ImGui-based UI
- Cross-platform support (Linux, Windows, macOS)

## Building

### Prerequisites

- CMake (>= 3.20)
- OpenGL development libraries
- GLFW (>= 3.3)
- Dear ImGui

### Build Instructions

```bash
mkdir build && cd build
cmake ..
make
./MP3IMGUI
```

## Running

```bash
GDK_BACKEND=x11 ./MP3IMGUI
```

## Configuration

Configuration can be adjusted via `imgui.ini` which stores window positions and settings.

## License

This project is licensed under the MIT License - see the LICENSE file for details.
