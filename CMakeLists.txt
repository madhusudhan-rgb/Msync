cmake_minimum_required(VERSION 3.20)

project(MP3IMGUI LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)

find_package(OpenGL REQUIRED)
find_package(glfw3 3.3 REQUIRED)

set(IMGUI_DIR ${CMAKE_CURRENT_SOURCE_DIR})

add_executable(MP3IMGUI
    ${IMGUI_DIR}/src/main.cpp
    ${IMGUI_DIR}/audiosrc/audio.cpp

    ${IMGUI_DIR}/imgui.cpp
    ${IMGUI_DIR}/imgui_draw.cpp
    ${IMGUI_DIR}/imgui_tables.cpp
    ${IMGUI_DIR}/imgui_widgets.cpp
    ${IMGUI_DIR}/imgui_demo.cpp

    ${IMGUI_DIR}/backends/imgui_impl_glfw.cpp
    ${IMGUI_DIR}/backends/imgui_impl_opengl3.cpp
)

target_include_directories(MP3IMGUI PRIVATE
    ${IMGUI_DIR}
    ${IMGUI_DIR}/backends
    ${IMGUI_DIR}/audiosrc
)

target_link_libraries(MP3IMGUI PRIVATE
    glfw
    OpenGL::GL
    ${CMAKE_DL_LIBS}
    pthread
    m
)

target_compile_options(MP3IMGUI PRIVATE
    -Wall
    -Wextra
    -Wpedantic
)
add_custom_target(run
    COMMAND ${CMAKE_COMMAND} -E env GDK_BACKEND=x11 $<TARGET_FILE:MP3IMGUI>
    DEPENDS MP3IMGUI
    WORKING_DIRECTORY ${CMAKE_CURRENT_SOURCE_DIR}
    )