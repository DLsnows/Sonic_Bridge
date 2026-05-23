cmake_minimum_required(VERSION 3.22)

# Static CRT must be set BEFORE project() — ensures /MT over /MD
set(CMAKE_MSVC_RUNTIME_LIBRARY "MultiThreaded$<$<CONFIG:Debug>:Debug>")
set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

project(SonicBridgeVST VERSION 1.0.0)

# --- JUCE Setup ---
# Point this to your local JUCE installation, or use FetchContent
set(JUCE_PATH "" CACHE PATH "Path to JUCE root directory")

if(NOT JUCE_PATH)
  message(FATAL_ERROR "JUCE_PATH must be set. Example: -DJUCE_PATH=/path/to/JUCE")
endif()

add_subdirectory(${JUCE_PATH} juce)

# --- Plugin Target ---
juce_add_plugin(SonicBridgeVST
  COMPANY_NAME        "SonicBridge"
  PLUGIN_MANUFACTURER_CODE SBrg
  PLUGIN_CODE         0001
  FORMATS             VST3
  PRODUCT_NAME        "SonicBridge VST"

  # "Fx" is added automatically by JUCE for VST3 audio effects.
  # Only specify sub-categories here to avoid duplicate "Fx" in moduleinfo.json.
  VST3_CATEGORIES     "Analyzer"

  # Bundle identifier
  BUNDLE_ID           "com.sonicbridge.vst"
)

# --- Dependencies (all static via x64-windows-static triplet) ---

# ixwebsocket (static, bundles mbedtls for TLS — no separate OpenSSL needed)
find_package(ixwebsocket CONFIG REQUIRED)
find_path(IXWEBSOCKET_INCLUDE_DIR ixwebsocket/IXWebSocketServer.h REQUIRED)

# --- Source Files ---
target_sources(SonicBridgeVST PRIVATE
  PluginProcessor.h
  PluginProcessor.cpp
  PluginEditor.h
  PluginEditor.cpp
  VstBridgeServer.h
  VstBridgeServer.cpp
  AudioMeter.h
  AudioMeter.cpp
  PluginLookAndFeel.h
  PluginLookAndFeel.cpp
  WebSocketProtocol.h
  WebSocketProtocol.cpp
)

# --- Include Directories ---
target_include_directories(SonicBridgeVST PRIVATE
  ${CMAKE_CURRENT_SOURCE_DIR}
  ${IXWEBSOCKET_INCLUDE_DIR}
)

# --- Link Libraries ---
target_link_libraries(SonicBridgeVST PRIVATE
  juce::juce_audio_plugin_client
  ixwebsocket::ixwebsocket
)

# mbedtls (bundled with ixwebsocket) requires bcrypt for BCryptGenRandom on Windows
if(WIN32)
  target_link_libraries(SonicBridgeVST PRIVATE bcrypt)
endif()

# --- Compiler Options ---
if(MSVC)
  target_compile_options(SonicBridgeVST PRIVATE /W4 /utf-8)
else()
  target_compile_options(SonicBridgeVST PRIVATE -Wall -Wextra -Wpedantic)
endif()

# Disable VST2 replacement mode — this is a VST3-only plugin
target_compile_definitions(SonicBridgeVST PRIVATE JUCE_VST3_CAN_REPLACE_VST2=0)

# --- Platform-Specific ---
if(WIN32)
  message(STATUS "Building SonicBridge VST3 for Windows (static)")
elseif(APPLE)
  message(STATUS "Building SonicBridge VST3 for macOS")
endif()
