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
# libopus (via vcpkg or system)
find_package(Opus CONFIG QUIET)
if(NOT Opus_FOUND)
  find_package(PkgConfig QUIET)
  if(PkgConfig_FOUND)
    pkg_check_modules(OPUS opus)
  endif()
  if(NOT OPUS_FOUND)
    find_path(OPUS_INCLUDE_DIRS opus/opus.h)
    find_library(OPUS_LIBRARIES opus)
    if(NOT OPUS_INCLUDE_DIRS OR NOT OPUS_LIBRARIES)
      message(FATAL_ERROR "libopus not found. Install with: vcpkg install opus")
    endif()
  endif()
endif()

# ixwebsocket
find_package(ixwebsocket CONFIG REQUIRED)

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
  ${CMAKE_CURRENT_SOURCE_DIR}
)
if(NOT Opus_FOUND AND OPUS_INCLUDE_DIRS)
  target_include_directories(SonicBridgeVST PRIVATE ${OPUS_INCLUDE_DIRS})
endif()

# --- Link Libraries ---
if(Opus_FOUND)
  set(OPUS_TARGET Opus::opus)
else()
  set(OPUS_TARGET ${OPUS_LIBRARIES})
endif()

target_link_libraries(SonicBridgeVST PRIVATE
  juce::juce_audio_plugin_client
  ${OPUS_TARGET}
  ixwebsocket::ixwebsocket
  OpenSSL::SSL
  OpenSSL::Crypto
)

# ixwebsocket + mbedtls requires bcrypt on Windows
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
  # Windows: VST3 is the default
  message(STATUS "Building SonicBridge VST3 for Windows")
elseif(APPLE)
  message(STATUS "Building SonicBridge VST3 for macOS")
  # Optional: add AU format
  # set_target_properties(SonicBridgeVST PROPERTIES JUCE_FORMATS "VST3;AU")
endif()

# --- Post-Build: copy dependency DLLs alongside VST3 ---
if(WIN32)
  set(VCPKG_INSTALLED "" CACHE PATH
      "Path to vcpkg installed directory for x64-windows triplet. Auto-detected when using vcpkg toolchain.")
  if(NOT VCPKG_INSTALLED)
    if(DEFINED CMAKE_TOOLCHAIN_FILE AND CMAKE_TOOLCHAIN_FILE MATCHES "vcpkg")
      get_filename_component(_vcpkg_scripts "${CMAKE_TOOLCHAIN_FILE}" DIRECTORY)
      get_filename_component(_vcpkg_root "${_vcpkg_scripts}/../.." ABSOLUTE)
      if(EXISTS "${_vcpkg_root}/installed/${VCPKG_TARGET_TRIPLET}")
        set(VCPKG_INSTALLED "${_vcpkg_root}/installed/${VCPKG_TARGET_TRIPLET}")
      endif()
    elseif(DEFINED ENV{VCPKG_ROOT})
      set(VCPKG_INSTALLED "$ENV{VCPKG_ROOT}/installed/${VCPKG_TARGET_TRIPLET}")
    endif()
  endif()
  if(VCPKG_INSTALLED AND EXISTS "${VCPKG_INSTALLED}")
    message(STATUS "vcpkg installed dir: ${VCPKG_INSTALLED}")
    add_custom_command(TARGET SonicBridgeVST POST_BUILD
      COMMAND ${CMAKE_COMMAND} -E copy_if_different
        "${VCPKG_INSTALLED}/bin/opus.dll"
        "$<TARGET_FILE_DIR:SonicBridgeVST>/opus.dll"
      COMMAND ${CMAKE_COMMAND} -E copy_if_different
        "${VCPKG_INSTALLED}/bin/z.dll"
        "$<TARGET_FILE_DIR:SonicBridgeVST>/z.dll"
      COMMAND ${CMAKE_COMMAND} -E copy_if_different
        "${VCPKG_INSTALLED}/bin/libcrypto-3-x64.dll"
        "$<TARGET_FILE_DIR:SonicBridgeVST>/libcrypto-3-x64.dll"
      COMMAND ${CMAKE_COMMAND} -E copy_if_different
        "${VCPKG_INSTALLED}/bin/libssl-3-x64.dll"
        "$<TARGET_FILE_DIR:SonicBridgeVST>/libssl-3-x64.dll"
      COMMENT "Copying dependency DLLs to VST3 bundle"
    )
  else()
    message(WARNING "vcpkg installed dir not found. Set -DVCPKG_INSTALLED=... to enable DLL copy.")
  endif()
endif()
