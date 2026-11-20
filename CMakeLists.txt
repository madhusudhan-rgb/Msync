cmake_minimum_required(VERSION 3.20)

project(MP3IMGUI LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)

find_package(OpenGL REQUIRED)
find_package(glfw3 3.3 REQUIRED)

set(IMGUI_DIR ${CMAKE_CURRENT_SOURCE_DIR}/external/imgui)

add_executable(MP3IMGUI
    src/main.cpp

    ${IMGUI_DIR}/imgui.cpp
    ${IMGUI_DIR}/imgui_draw.cpp
    ${IMGUI_DIR}/imgui_tables.cpp
    ${IMGUI_DIR}/imgui_widgets.cpp

    ${IMGUI_DIR}/backends/imgui_impl_glfw.cpp
    ${IMGUI_DIR}/backends/imgui_impl_opengl3.cpp
)

target_include_directories(MP3IMGUI PRIVATE
    ${IMGUI_DIR}
    ${IMGUI_DIR}/backends
)

target_link_libraries(MP3IMGUI PRIVATE
    glfw
    OpenGL::GL
    ${CMAKE_DL_LIBS}
)

target_compile_options(MP3IMGUI PRIVATE
    -Wall
    -Wextra
    -Wpedantic
)
add_custom_target(run 
    COMMAND ${CMAKE_COMMAND} -E GDK_BACKEND=x11 $<TARGET_FILE:MP3IMGUI>
    DEPENDS MPEIMGUI
    WORKING_DIRECTORY ${CMAKE_CURRENT_SOURCE_DIR}
    )