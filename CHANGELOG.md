# Update Notes 🚗

## Version Information 📋
- Current Version: 1.0.3 Stable ✨
- Previous Version: 1.0.0 Stable 📦
- Update Date: 2024-12-27 🗓️
- Fixed login expiration issue, refactored code, improved menu structure

## Main Updates 🎉

### 1. Version Management Optimization 🔄
- Added version type management (Stable/Beta/Alpha) 🏷️
- Supports account data migration between different versions 📲
- Optimized how version number and type are read 📝

### 2. Data Storage Refactoring 💾
- Introduced a StorageBase base class to unify data storage logic 🏗️
- Added three data management classes: AccountInfo, WidgetSettings, vehicleCache 📊
- Supports versioned file naming and storage 📂

### 3. Update Mechanism Optimization 🔃
- Supports three update channels (Stable/Beta/Alpha) 🔀
- Added auto-update settings ⚙️
- Optimized update checking and installation process 🔧

### 4. Interface Function Enhancement 🎨
- Refactored menu structure for clearer function categorization 📋
- Added widget settings features ⚡️
  - Background image setting 🖼️
  - Background blur adjustment 🌫️
  - Multiple preview sizes 📱

### 5. Performance Optimization ⚡️
- Optimized data caching mechanism 💫
- Improved retry mechanism delay strategy ⏱️
- Optimized file read/write operations 📝

### 6. Other Improvements 🔨
- Improved error handling and logging 📝
- Optimized code structure and comments 💻
- Fixed login invalidation issue 🔐

## Upgrade Recommendations 💡
1. It is recommended to back up your current version before upgrading 💾
2. You may need to log in again on first run after upgrading 🔑
3. If you encounter issues, you can switch back to the stable version ⚠️

## Notes ⚠️
- The Alpha version may have unknown issues 🐛
- If you experience functional anomalies, please switch to the stable version 🔙
- It is recommended to regularly back up important data 💾
