cmake_minimum_required(VERSION 3.22)
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

  # VST3 category: kFxAnalyzer (for metering/analysis plugins)
  VST3_CATEGORIES     "Fx|Analyzer"

  # Bundle identifier
  BUNDLE_ID           "com.sonicbridge.vst"
)

# --- Dependencies ---
# libopus
find_package(PkgConfig)
if(PkgConfig_FOUND)
  pkg_check_modules(OPUS opus)
endif()

if(NOT OPUS_FOUND)
  # Fallback: assume opus is installed system-wide
  find_path(OPUS_INCLUDE_DIRS opus/opus.h)
  find_library(OPUS_LIBRARIES opus)
  if(NOT OPUS_INCLUDE_DIRS OR NOT OPUS_LIBRARIES)
    message(FATAL_ERROR "libopus not found. Install with: vcpkg install opus")
  endif()
endif()

# ixwebsocket
find_package(ixwebsocket REQUIRED)

# OpenSSL (required by ixwebsocket)
find_package(OpenSSL REQUIRED)

# --- Source Files ---
target_sources(SonicBridgeVST PRIVATE
  PluginProcessor.h
  PluginProcessor.cpp
  PluginEditor.h
  PluginEditor.cpp
  VstBridgeServer.h
  VstBridgeServer.cpp
  AudioEncoder.h
  AudioEncoder.cpp
  AudioMeter.h
  AudioMeter.cpp
  PluginLookAndFeel.h
  PluginLookAndFeel.cpp
  WebSocketProtocol.h
  WebSocketProtocol.cpp
)

# --- Include Directories ---
target_include_directories(SonicBridgeVST PRIVATE
  ${OPUS_INCLUDE_DIRS}
  ${CMAKE_CURRENT_SOURCE_DIR}
)

# --- Link Libraries ---
target_link_libraries(SonicBridgeVST PRIVATE
  juce::juce_audio_plugin_client
  ${OPUS_LIBRARIES}
  ixwebsocket::ixwebsocket
  OpenSSL::SSL
  OpenSSL::Crypto
)

# --- Compiler Options ---
if(MSVC)
  target_compile_options(SonicBridgeVST PRIVATE /W4 /utf-8)
else()
  target_compile_options(SonicBridgeVST PRIVATE -Wall -Wextra -Wpedantic)
endif()

# --- Platform-Specific ---
if(WIN32)
  # Windows: VST3 is the default
  message(STATUS "Building SonicBridge VST3 for Windows")
elseif(APPLE)
  message(STATUS "Building SonicBridge VST3 for macOS")
  # Optional: add AU format
  # set_target_properties(SonicBridgeVST PROPERTIES JUCE_FORMATS "VST3;AU")
endif()
