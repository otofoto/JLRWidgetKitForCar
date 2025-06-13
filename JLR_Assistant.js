// Variables used by Scriptable.
// These must be at the very top of the file. Do not edit.
// icon-color: orange; icon-glyph: car;
// Version: 1.0.3 Stable
// Update time: 2024-12-27 09:40:00
// Author: xuyuanfang
// Description: "Smart Assistant" Land Rover Helper
// Github: https://github.com/xuyuanfang/WidgetKitForCar
// License: GPL-3.0
// Changelog: Fixed login expiration issue, refactored code, improved menu structure

// Version Management
class VersionManager {
  static #version = null;
  static #versionType = null;

  static getVersionInfo() {
    if (!this.#version || !this.#versionType) {
      const fm = FileManager.local();
      const fileContent = fm.readString(module.filename);
      const match = fileContent.match(/^\/\/ Version: (\d+\.\d+\.\d+)\s+(\w+)/m);
      this.#version = match?.[1] || '0.0.0';
      this.#versionType = match?.[2] || 'Stable';
    }
    return {
      version: this.#version,
      type: this.#versionType
    };
  }

  static getFileName(type) {
    const { type: versionType } = this.getVersionInfo();
    return `jlr-${versionType.toLowerCase()}-${type}.json`;
  }
}

// File Operations Base Class
class StorageBase {
  async _loadFromFile(filename) {
    try {
      const fm = FileManager.local();
      const path = fm.joinPath(
        fm.documentsDirectory(),
        VersionManager.getFileName(filename)
      );
      if (!fm.fileExists(path)) {
        return null;
      }
      const content = fm.readString(path);
      return JSON.parse(content);
    } catch (error) {
      console.error(`Failed to read ${filename}:`, error);
      return null;
    }
  }

  async _saveToFile(filename, data) {
    try {
      const fm = FileManager.local();
      const path = fm.joinPath(
        fm.documentsDirectory(),
        VersionManager.getFileName(filename)
      );
      fm.writeString(path, JSON.stringify(data));
    } catch (error) {
      console.error(`Failed to save ${filename}:`, error);
    }
  }
}

// Account Configuration
class AccountInfo extends StorageBase {
  static _instance = null;
  static async getInstance() {
    if (!this._instance) {
      this._instance = new AccountInfo();
      await this._instance._initializeFromStorage();
    }
    return this._instance;
  }

  constructor() {
    super();
    if (AccountInfo._instance) {
      return AccountInfo._instance;
    }
    AccountInfo._instance = this;
  }

  async _initializeFromStorage() {
    // Try to read the account info for the current version
    const data = await this._loadFromFile('account');
    log(`Current version account info: ${JSON.stringify(data)}`);
    if (!data?.username) {
      log("No account info in current version, trying to load from other versions");
      const otherVersionData = await this._tryLoadFromOtherVersions();
      log(`Other version data: ${JSON.stringify(otherVersionData)}`);
      if (otherVersionData) {
        log(`Found account info from ${otherVersionData.type} version`);
        const alert = new Alert();
        alert.title = "Found Saved Account";
        alert.message = `Found account info from ${otherVersionData.type} version:\n${otherVersionData.data.username}\n\nUse this account to login?`;
        alert.addAction("Use");
        alert.addCancelAction("Cancel");
        const userChoice = await alert.present();
        log(`User choice: ${userChoice}`);
        if (userChoice !== -1) {
          log("User agreed to use existing account, saving now");
          await this._saveToFile('account', otherVersionData.data);
          this._initializeFromData(otherVersionData.data);
          return;
        }
      } else {
        log("No account info found in other versions");
      }
    } else {
      log("Current version already has account info");
    }
    this._initializeFromData(data);
  }

  async _tryLoadFromOtherVersions() {
    const versions = ['Stable', 'Beta', 'Alpha'];
    const currentType = (await VersionManager.getVersionInfo()).type.toLowerCase();
    log(`Current version type: ${currentType}`);
    for (let type of versions) {
      type = type.toLowerCase();
      if (type === currentType) {
        log(`Skipping current version: ${type}`);
        continue;
      }
      try {
        const fm = FileManager.local();
        const path = fm.joinPath(
          fm.documentsDirectory(),
          `jlr-${type}-account.json`
        );
        log(`Trying to read file: ${path}`);
        if (fm.fileExists(path)) {
          log(`File exists: ${path}`);
          const content = fm.readString(path);
          const data = JSON.parse(content);
          if (data?.username && data?.refreshToken) {
            log(`Found valid account info: ${data.username}`);
            return {
              type: type.charAt(0).toUpperCase() + type.slice(1),
              data: data
            };
          } else {
            log(`File exists but account info is invalid`);
          }
        } else {
          log(`File does not exist: ${path}`);
        }
      } catch (error) {
        log(`Failed to read ${type} version account info: ${error.message}`);
      }
    }
    return null;
  }

  _initializeFromData(data) {
    this.username = data?.username || null;
    this.password = data?.password || null;
    this.accessToken = data?.accessToken || null;
    this.refreshToken = data?.refreshToken || null;
    this.authToken = data?.authToken || null;
    this.tokenExpiry = data?.tokenExpiry || 0;
    this.userId = data?.userId || null;
    this.email = data?.email || null;
    this.deviceId = data?.deviceId || UUID.string().toLowerCase();
    this.vehicleId = data?.vehicleId || null;
  }

  async save() {
    await this._saveToFile('account', {
      username: this.username,
      password: this.password,
      accessToken: this.accessToken,
      refreshToken: this.refreshToken,
      authToken: this.authToken,
      tokenExpiry: this.tokenExpiry,
      userId: this.userId,
      email: this.email,
      deviceId: this.deviceId,
      vehicleId: this.vehicleId
    });
  }
}

// Display Settings
class WidgetSettings extends StorageBase {
  static _instance = null;
  static async getInstance() {
    if (!this._instance) {
      this._instance = new WidgetSettings();
      await this._instance._initializeFromStorage();
    }
    return this._instance;
  }

  constructor() {
    super();
    if (WidgetSettings._instance) {
      return WidgetSettings._instance;
    }
    WidgetSettings._instance = this;
  }

  async _initializeFromStorage() {
    const data = await this._loadFromFile('settings');
    this.updateInterval = data?.updateInterval || 300;
    this.backgroundBlur = data?.backgroundBlur || 0;
    this.theme = data?.theme || 'auto';
    this.fontSize = data?.fontSize || 12;
    this.textColor = data?.textColor || '#000000';
    this.layout = data?.layout || 'default';
    this.showItems = data?.showItems || {
      battery: true,
      fuel: true,
      location: true,
      lastUpdate: true
    };
    this.autoUpdate = data?.autoUpdate || false;
    this.autoUpdateType = data?.autoUpdateType || 'stable'; 
  }

  async save() {
    await this._saveToFile('settings', {
      updateInterval: this.updateInterval,
      backgroundBlur: this.backgroundBlur,
      theme: this.theme,
      fontSize: this.fontSize,
      textColor: this.textColor,
      layout: this.layout,
      showItems: this.showItems,
      autoUpdate: this.autoUpdate,
      autoUpdateType: this.autoUpdateType
    });
  }
}

// Data Cache
class vehicleCache extends StorageBase {
  static _instance = null;
  static async getInstance() {
    if (!this._instance) {
      this._instance = new vehicleCache();
      await this._instance._initializeFromStorage();
    }
    return this._instance;
  }

  constructor() {
    super();
    if (vehicleCache._instance) {
      return vehicleCache._instance;
    }
    vehicleCache._instance = this;
  }

  async _initializeFromStorage() {
    const data = await this._loadFromFile('cache');
    this.attributes = data?.attributes || null;
    this.status = data?.status || null;
    this.position = data?.position || null;
    this.lastUpdate = data?.lastUpdate || null;
    this.timestamp = data?.timestamp || null;
  }

  async save() {
    await this._saveToFile('cache', {
      attributes: this.attributes,
      status: this.status,
      position: this.position,
      lastUpdate: this.lastUpdate,
      timestamp: this.timestamp
    });
  }
}

// API Configuration
//    """China Base URLs"""
const API_CONFIG_China = {
    baseUrls: {
        IFAS: "https://ifas.prod-chn.jlrmotor.com/ifas/jlr",
        IFOP: "https://ifop.prod-chn.jlrmotor.com/ifop/jlr",
       // IFOA: "https://ifoa.prod-chn.jlrmotor.com"
        IFOA = "https://ifoa.prod-chn.jlrmotor.com/if9/jlr"
    },
    extendUrl: "https://landrover.xiaojilinggui.com"
};
// """Rest Of World Base URLs"""

const API_CONFIG = {
  baseUrls: {
    IFAS: "https://ifas.prod-row.jlrmotor.com/ifas/jlr",
    IFOP: "https://ifop.prod-row.jlrmotor.com/ifop/jlr",
//    IFOA: "https://ifoa.prod-row.jlrmotor.com"
    IFOA: "https://if9.prod-row.jlrmotor.com"
   
  },
  extendUrl: "https://github.com/otofoto/JLRWidgetKitForCar"
};

// Utility Functions
class Utils {
  static async wait(seconds) {
    log(`Starting wait for ${seconds} seconds...`);
    const startTime = Date.now();
    while (Date.now() - startTime < seconds * 1000) {
      await new Promise(resolve => {
        const timer = new Timer();
        timer.timeInterval = 0.1;
        timer.schedule(function() {
          resolve();
          timer.invalidate();
        });
      });
    }
    const actualWait = (Date.now() - startTime) / 1000;
    log(`Wait complete, actually waited ${actualWait.toFixed(1)} seconds`);
  }

  static async retry(operation, maxAttempts = 3) {
    let lastError;
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error;
        if (attempt === maxAttempts - 1) {
          throw new Error(`Operation failed after ${maxAttempts} attempts: ${error.message}`);
        }
        const delay = 2 * Math.pow(2, attempt);
        log(`Attempt ${attempt + 1} failed, waiting ${delay} seconds before retry`);
        await this.wait(delay);
        log(`Starting attempt ${attempt + 2}`);
      }
    }
    throw lastError;
  }

  static async getBackgroundImage() {
    const fm = FileManager.local();
    const bgPath = fm.joinPath(fm.documentsDirectory(), VersionManager.getFileName('background').replace('.json', '.jpg'));
    const settings = await WidgetSettings.getInstance();
    const currentBlur = settings.backgroundBlur;
    let img = null;
    if (fm.fileExists(bgPath)) {
      img = fm.readImage(bgPath);
      if (img && currentBlur > 0) {
        const drawContext = new DrawContext();
        drawContext.size = new Size(img.size.width, img.size.height);
        drawContext.drawImageInRect(img, new Rect(0, 0, img.size.width, img.size.height));
        const alpha = currentBlur / 100 * 1;
        drawContext.setFillColor(new Color("#000000", alpha));
        drawContext.fillRect(new Rect(0, 0, img.size.width, img.size.height));
        return drawContext.getImage();
      }
    }
    return img;
  }

  static formatObject(obj, result = []) {
    if (!obj || typeof obj !== 'object') return result;
    const processValue = (value) => {
      if (value === null || value === undefined || value === '') return false;
      if (typeof value === 'object') {
        if ('capabilities' in value) return false;
        return true;
      }
      return true;
    };
    Object.entries(obj).forEach(([key, value]) => {
      if (!processValue(value)) return;
      if (typeof value === 'object') {
        if (Array.isArray(value)) {
          value.forEach((item, index) => {
            if (typeof item === 'object') {
              if ('key' in item && 'value' in item) {
                result.push(`${item.key}: ${item.value}`);
              } else {
                this.formatObject(item, result);
              }
            } else if (processValue(item)) {
              result.push(`${key}: ${item}`);
            }
          });
        } else {
          if ('key' in value && 'value' in value) {
            result.push(`${value.key}: ${value.value}`);
          } else {
            this.formatObject(value, result);
          }
        }
      } else {
        result.push(`${key}: ${value}`);
      }
      result.forEach((item, index) => {
        if (item.includes("authToken")) {
          result[index] = `${item.substring(0, 20)}... (truncated)`;
        }
      });
    });
    return result;
  }

  static findLatestTime(status) {
    let latestTime = status.lastUpdatedTime;
    if (status.vehicleAlerts && Array.isArray(status.vehicleAlerts)) {
      status.vehicleAlerts.forEach(alert => {
        if (alert.lastUpdatedTime) {
          const alertTime = alert.lastUpdatedTime;
          if (!latestTime || new Date(alertTime) > new Date(latestTime)) {
            latestTime = alertTime;
          }
        }
      });
    }
    return latestTime;
  }
}

// API Class
class JLRConnectAPI {
  static async _checkAndRefreshToken(useToken = true) {
    const account = await AccountInfo.getInstance();
    const now = Math.floor(Date.now() / 1000);
    if (account.refreshToken) {
      log(`accessToken remaining validity: ${Math.floor(account.tokenExpiry - 3600 * 23 - 60 * 50 - now)} seconds`);
      if (account.accessToken && account.authToken && now < account.tokenExpiry - 3600 * 23 - 60 * 50) {
        if (!account.userId) {
          await this._getUserInfo();
        } else {
          log("User ID exists, skipping user info fetch");
        }
      } else {
        log("accessToken expired or not set, attempting refresh");
        try {
          await this._forceRefreshToken();
          log("accessToken refresh successful");
          await this._registerClient();
          if (!account.userId) {
            await this._getUserInfo();
          } else {
            log("User ID exists, skipping user info fetch");
          }
          log("accessToken update complete");
        } catch (error) {
          log("accessToken refresh failed, login required");
          throw new Error("Authentication expired, please login again");
        }
      }
    } else {
      log("refreshToken not found or expired, login required");
      throw new Error("No valid authentication info found, please login again");
    }
  }

  static async _forceRefreshToken() {
    const account = await AccountInfo.getInstance();
    await this._authenticate({
      grant_type: "refresh_token",
      refresh_token: account.refreshToken
    });
  }

  static async connect(username, password) {
    if (!username || !password) {
      log("Username and password are empty, please set them first");
      return;
    }
    log("Starting connection...");
    log("Logging in with password");
    try {
      await this._authenticate({
        grant_type: "password",
        username: username,
        password: password
      });
    } catch (error) {
      log("Password login failed, please login again");
      throw new Error("Password login failed, please login again");
    }
    await this._registerClient();
    await this._getUserInfo();
  }

  static async connectByAccountOrToken() {
    const account = await AccountInfo.getInstance();
    log("Attempting token login");
    log(`accessToken: ${account.accessToken}`);
    log(`authToken: ${account.authToken?.substring(0, 20)}... (truncated)`);
    log(`refreshToken: ${account.refreshToken}`);
    if (account.accessToken && account.authToken && account.refreshToken) {
      log("accessToken exists");
      try {
        await this._checkAndRefreshToken();
        log("Successfully logged in with existing accessToken");
      } catch (error) {
        log("Existing accessToken failed, logging in with password");
        await this.connect(account.username, account.password);
      }
    } else {
      log("accessToken does not exist, logging in with password");
      await this.connect(account.username, account.password);
    }
  }

  static async _authenticate(data) {
    return await Utils.retry(async () => {
    //  const url = `${API_CONFIG.baseUrls.IFAS}/tokens/tokensSSO`;
      const url = `${API_CONFIG.baseUrls.IFAS}/tokens/tokens`;
      log(`Authentication URL: ${url}`);
      const request = new Request(url);
      request.method = "POST";
      request.headers = {
        "Host": "ifas.prod-row.jlrmotor.com",
        "Authorization": "Basic YXM6YXNwYXNz",
        "Content-Type": "application/json",
        "user-agent": "jlrpy",
        "Accept": "*/*"
      };
      log(`Authentication type: ${data.grant_type}`);
      if (data.grant_type === "password") {
        log(`Using account: ${data.username}`);
      } else {
        log("Using refreshToken");
      }
      request.body = JSON.stringify(data);
      request.timeoutInterval = 5;
      const response = await request.loadString();
      const statusCode = request.response.statusCode;
      if (statusCode === 200) {
        log(`Authentication succeeded, status code: ${statusCode}`);
      } else {
        log(`Authentication failed, status code: ${statusCode}`);
      }
      if (!response || response.trim().length === 0) {
        log("Incorrect username or password");
        throw new Error('Incorrect username or password');
      }
      const jsonResponse = JSON.parse(response);
      log("Authentication succeeded");
      const account = await AccountInfo.getInstance();
      if (data.grant_type === "password") {
        account.username = data.username;
        account.password = data.password;
      }
      account.accessToken = jsonResponse.access_token;
      account.refreshToken = jsonResponse.refresh_token;
      account.authToken = jsonResponse.authorization_token;
      account.tokenExpiry = Math.floor(Date.now() / 1000) + parseInt(jsonResponse.expires_in);
      log(`accessToken: ${account.accessToken}`);
      log(`refreshToken: ${account.refreshToken}`);
      log(`authToken: ${account.authToken?.substring(0, 20)}... (truncated)`);
      log(`tokenExpiry: ${account.tokenExpiry}`);
      await account.save();
      return jsonResponse;
    });
  }

  static async _registerClient() {
    return await Utils.retry(async () => {
      const account = await AccountInfo.getInstance();
      const url = `${API_CONFIG.baseUrls.IFOP}/users/${account.username}/clients`;
      log(`Register client URL: ${url}`);
      await account.save();
      const request = new Request(url);
      request.method = "POST";
      request.headers = {
        "Host": "ifop.prod-row.jlrmotor.com",
        "Authorization": `Bearer ${account.accessToken}`,
        "Content-Type": "application/json",
        "Accept": "*/*",
        "X-Device-Id": account.deviceId,
        "x-telematicsprogramtype": "jlrpy",
        "x-App-Id": "ICR_JAGUAR_ANDROID",
        "x-App-Secret": "7bf6f544-1926-4714-8066-ceceb40d538d"
      };
      const data = {
        access_token: account.accessToken,
        authorization_token: account.authToken,
        expires_in: "86400",
        deviceID: account.deviceId
      };
      log(`deviceID: ${account.deviceId}`);
      request.body = JSON.stringify(data);
      request.timeoutInterval = 5;
      await request.loadString();
      const statusCode = request.response.statusCode;
      if (statusCode === 204) {
        log(`Client registration status code: ${statusCode}`);
      } else {
        log(`Client registration error, status code: ${statusCode}`);
      }
    });
  }

  static async _getUserInfo() {
    return await Utils.retry(async () => {
      const account = await AccountInfo.getInstance();
      const url = `${API_CONFIG.baseUrls.IFOA}/if9/jlr/users?loginName=${account.username}`;
      log(`Get user info URL: ${url}`);
      const request = new Request(url);
      request.method = "GET";
      request.timeoutInterval = 5;
      request.headers = {
        "Host": "ifoa.prod-row.jlrmotor.com",
        "Authorization": `Bearer ${account.accessToken}`,
        "Accept": "application/vnd.wirelesscar.ngtp.if9.User-v3+json",
        "Content-Type": "application/json",
        "X-Device-Id": account.deviceId,
        "x-telematicsprogramtype": "jlrpy",
        "x-App-Id": "ICR_JAGUAR_ANDROID",
        "x-App-Secret": "7bf6f544-1926-4714-8066-ceceb40d538d"
      };
      const response = await request.loadString();
      const statusCode = request.response.statusCode;
      if (statusCode === 200) {
        const data = JSON.parse(response);
        if (!data.userId) {
          throw new Error('Failed to retrieve user ID');
        }
        account.userId = data.userId;
        log(`User ID obtained: ${account.userId}`);
        log(`Get user info status code: ${statusCode}`);
        await account.save();
        return data;
      } else {
        log(`Get user info error, status code: ${statusCode}`);
        if (statusCode === 401) {
          log("accessToken expired, login required");
          await this._forceRefreshToken();
          await this._registerClient();
          throw new Error("accessToken expired, please login again");
        }
      }
    });
  }

  static async getVehicleList() {
    const account = await AccountInfo.getInstance();
    if (!account.userId) {
      log("User ID not found, unable to retrieve vehicle list");
      return null;
    }
    return await Utils.retry(async () => {
      const url = `${API_CONFIG.baseUrls.IFOA}/if9/jlr/users/${account.userId}/vehicles?primaryOnly=true`;
      log(`Get vehicle list URL: ${url}`);
      const request = new Request(url);
      request.method = "GET";
      request.headers = {
        "Host": "ifoa.prod-row.jlrmotor.com",
        "Authorization": `Bearer ${account.accessToken}`,
        "Accept": "*/*",
        "Content-Type": "application/json",
        "X-Device-Id": account.deviceId,
        "x-telematicsprogramtype": "jlrpy",
        "x-App-Id": "ICR_JAGUAR_ANDROID",
        "x-App-Secret": "7bf6f544-1926-4714-8066-ceceb40d538d"
      };
      request.timeoutInterval = 5;
      const response = await request.loadString();
      const statusCode = request.response.statusCode;
      if (statusCode === 200) {
        const data = JSON.parse(response);
        log(`Get vehicle list status code: ${statusCode}`);
        return data.vehicles;
      } else {
        log(`Get vehicle list error, status code: ${statusCode}`);
      }
    });
  }

  static async getVehicleAttributes(vin = null) {
    const account = await AccountInfo.getInstance();
    if (!vin && !account.vehicleId) {
      log("Vehicle ID not found, unable to retrieve attributes");
      return null;
    }
    return await Utils.retry(async () => {
      const url = `${API_CONFIG.baseUrls.IFOA}/if9/jlr/vehicles/${vin || account.vehicleId}/attributes`;
      log(`Get vehicle attributes URL: ${url}`);
      const request = new Request(url);
      request.method = "GET";
      request.headers = {
        "Host": "ifoa.prod-row.jlrmotor.com",
        "Authorization": `Bearer ${account.accessToken}`,
        "Accept": "application/vnd.ngtp.org.VehicleAttributes-v8+json",
        "Content-Type": "application/json",
        "X-Device-Id": account.deviceId,
        "x-telematicsprogramtype": "jlrpy",
        "x-App-Id": "ICR_JAGUAR_ANDROID",
        "x-App-Secret": "7bf6f544-1926-4714-8066-ceceb40d538d"
      };
      request.timeoutInterval = 10;
      try {
        const response = await request.loadString();
        const statusCode = request.response.statusCode;
        log(`Get vehicle attributes status code: ${statusCode}`);
        if (statusCode === 200) {
          const data = JSON.parse(response);
          delete data.capabilities;
          return data;
        } else {
          log(`Get vehicle attributes error, status code: ${statusCode}`);
          throw new Error(`Failed to retrieve vehicle attributes, status code: ${statusCode}`);
        }
      } catch (error) {
        log(`Error getting vehicle attributes: ${error.message}`);
        throw error;
      }
    });
  }

  static async getVehicleStatus(vin = null) {
    const account = await AccountInfo.getInstance();
    if (!vin && !account.vehicleId) {
      log("Vehicle ID not found, unable to retrieve status");
      return null;
    }
    return await Utils.retry(async () => {
      const url = `${API_CONFIG.baseUrls.IFOA}/if9/jlr/vehicles/${vin || account.vehicleId}/status?includeInactive=true`;
      log(`Get vehicle status URL: ${url}`);
      const request = new Request(url);
      request.method = "GET";
      request.headers = {
        "Host": "ifoa.prod-row.jlrmotor.com",
        "Authorization": `Bearer ${account.accessToken}`,
        "Accept": "application/vnd.ngtp.org.if9.healthstatus-v4+json",
        "Content-Type": "application/json",
        "X-Device-Id": account.deviceId,
        "x-telematicsprogramtype": "jlrpy",
        "x-App-Id": "ICR_JAGUAR_ANDROID",
        "x-App-Secret": "7bf6f544-1926-4714-8066-ceceb40d538d"
      };
      request.timeoutInterval = 5;
      const response = await request.loadString();
      const statusCode = request.response.statusCode;
      if (statusCode === 200) {
        log(`Get vehicle status status code: ${statusCode}`);
        return JSON.parse(response);
      } else {
        log(`Get vehicle status error, status code: ${statusCode}`);
      }
    });
  }

  static async getVehiclePosition(vin = null) {
    const account = await AccountInfo.getInstance();
    if (!vin && !account.vehicleId) {
      log("Vehicle ID not found, unable to retrieve position");
      return null;
    }
    return await Utils.retry(async () => {
      const url = `${API_CONFIG.baseUrls.IFOA}/if9/jlr/vehicles/${vin || account.vehicleId}/position`;
      log(`Get vehicle position URL: ${url}`);
      const request = new Request(url);
      request.method = "GET";
      request.headers = {
        "Host": "ifoa.prod-row.jlrmotor.com",
        "Authorization": `Bearer ${account.accessToken}`,
        "Accept": "*/*",
        "Content-Type": "application/json",
        "X-Device-Id": account.deviceId,
        "x-telematicsprogramtype": "jlrpy",
        "x-App-Id": "ICR_JAGUAR_ANDROID",
        "x-App-Secret": "7bf6f544-1926-4714-8066-ceceb40d538d"
      };
      request.timeoutInterval = 5;
      const response = await request.loadString();
      const statusCode = request.response.statusCode;
      if (statusCode === 200) {
        log(`Get vehicle position status code: ${statusCode}`);
        return JSON.parse(response);
      } else {
        log(`Get vehicle position error, status code: ${statusCode}`);
      }
    });
  }
}

// Menu Management
class MenuManager {
  static async showMainMenu() {
    const account = await AccountInfo.getInstance();
    let intervalText = "5 minutes";
    if (account.updateInterval === 300) {
      intervalText = "5 minutes";
    } else if (account.updateInterval === 600) {
      intervalText = "10 minutes";
    } else if (account.updateInterval === 1800) {
      intervalText = "30 minutes";
    } else if (account.updateInterval === 3600) {
      intervalText = "1 hour";
    } else if (account.updateInterval === 7200) {
      intervalText = "2 hours";
    } else if (account.updateInterval === 10800) {
      intervalText = "3 hours";
    } else if (account.updateInterval === 21600) {
      intervalText = "6 hours";
    } else if (account.updateInterval < 300) {
      intervalText = `${account.updateInterval} seconds`;
    }
    const actions = [
      { title: "Account Settings", action: () => this.showAccountSettings() },
      { title: "Data Management", action: () => this.showDataManager() },
      { title: "Widget Settings", action: () => this.showWidgetSettings() },
      { title: "Check for Updates", action: () => this.checkUpdate() },
      { title: "About License", action: () => this.showCopyright() }
    ];
    const actionSheet = new Alert();
    actionSheet.title = "Land Rover Helper";
    actionSheet.message = `Current update interval: ${intervalText}`;
    actions.forEach(action => { actionSheet.addAction(action.title); });
    actionSheet.addCancelAction("Back");
    const response = await actionSheet.presentSheet();
    if (response !== -1) {
      await actions[response].action();
    }
  }

  static async showAccountSettings() {
    const account = await AccountInfo.getInstance();
    const alert = new Alert();
    alert.title = "Account Settings";
    if (account.username && account.password && account.userId) {
      alert.message = `Current account: ${account.username}`;
      alert.addAction("Select Vehicle");
      alert.addAction("Logout");
    } else {
      alert.message = "Not logged in, please login first";
      alert.addAction("Login Account");
    }
    alert.addAction("Recover Password");
    alert.addCancelAction("Back");
    const idx = await alert.presentSheet();
    if (idx === -1) {
      await this.showMainMenu();
      return;
    }
    if (account.username && account.password && account.userId) {
      switch (idx) {
        case 0: await this.showVehicleSelect(); await this.updateData(); break;
        case 1: await this.logout(); break;
        case 2: await this.resetPassword(); break;
      }
    } else {
      switch (idx) {
        case 0: await this.showLoginSheet(); break;
        case 1: await this.resetPassword(); break;
      }
    }
    await this.showAccountSettings();
  }

  static async selectVehicle() {
    try {
      const vehicles = await JLRConnectAPI.getVehicleList();
      if (!vehicles || vehicles.length === 0) {
        await this.showNotification("Error", "No vehicle found");
        return;
      }
      const alert = new Alert();
      alert.title = "Select Vehicle";
      alert.message = "Please select the vehicle to control";
      for (const vehicle of vehicles) {
        const attributes = await JLRConnectAPI.getVehicleAttributes(vehicle.vin);
        alert.addAction(`${attributes.nickname} ${attributes.registrationNumber} ${attributes.vehicleType} \n VIN: ${vehicle.vin}`);
      }
      alert.addCancelAction("Cancel");
      const idx = await alert.present();
      if (idx !== -1) {
        const selectedVehicle = vehicles[idx];
        const account = await AccountInfo.getInstance();
        account.vehicleId = selectedVehicle.vin;
        await account.save();
        return selectedVehicle;
      }
    } catch (error) {
      this.showNotification("Error", `Vehicle selection failed: ${error.message}`);
    }
    return null;
  }

  static async logout() {
    const account = await AccountInfo.getInstance();
    account.username = null;
    account.password = null;
    account.accessToken = null;
    account.refreshToken = null;
    account.authToken = null;
    account.tokenExpiry = 0;
    account.userId = null;
    account.vehicleId = null;
    await account.save();
    await this.showNotification("Logged Out", "Account has been logged out");
  }

  static async resetPassword() {
    const resetUrl = "https://incontrol.jaguar.com/jaguar-portal-owner-web/password-assistance/request-email";
    try {
      await Safari.open(resetUrl);
    } catch (error) {
      await WebView.loadURL(resetUrl);
    }
    await this.showNotification("Note", "Password reset page opened in browser");
  }

  static async showLoginSheet() {
    const alert = new Alert();
    alert.title = "Login Account";
    alert.message = "Please enter your login details";
    const account = await AccountInfo.getInstance();
    alert.addTextField("Email", account.username || "");
    alert.addSecureTextField("Password", account.password || "");
    alert.addAction("Save");
    alert.addCancelAction("Cancel");
    const idx = await alert.present();
    if (idx === 0) {
      try {
        await JLRConnectAPI.connect(alert.textFieldValue(0), alert.textFieldValue(1));
        await this.showVehicleSelect();
        await this.updateData();
      } catch (error) {
        await this.showNotification("Error", error.message);
      }
    }
  }

  static async showVehicleSelect() {
    try {
      const vehicles = await JLRConnectAPI.getVehicleList();
      if (!vehicles || vehicles.length === 0) {
        await this.showNotification("Error", "No vehicle found");
        return;
      }
      const alert = new Alert();
      alert.title = "Select Vehicle";
      alert.message = "Please select the vehicle to control";
      for (const vehicle of vehicles) {
        const attributes = await JLRConnectAPI.getVehicleAttributes(vehicle.vin);
        alert.addAction(`${attributes.nickname} ${attributes.registrationNumber} ${attributes.vehicleType} \n VIN: ${vehicle.vin}`);
      }
      alert.addCancelAction("Cancel");
      const idx = await alert.present();
      if (idx !== -1) {
        const selectedVehicle = vehicles[idx];
        const account = await AccountInfo.getInstance();
        account.vehicleId = selectedVehicle.vin;
        await account.save();
        return selectedVehicle;
      }
    } catch (error) {
      this.showNotification("Error", `Vehicle selection failed: ${error.message}`);
    }
    return null;
  }

  static async showUpdateIntervalSelect() {
    const alert = new Alert();
    alert.title = "Update Interval";
    alert.message = "Please select a data update interval";
    const intervals = [
      { name: "5 minutes", value: 300 },
      { name: "10 minutes", value: 600 },
      { name: "30 minutes", value: 1800 },
      { name: "1 hour", value: 3600 },
      { name: "2 hours", value: 7200 },
      { name: "3 hours", value: 10800 },
      { name: "6 hours", value: 21600 },
    ];
    intervals.forEach(interval => { alert.addAction(interval.name); });
    alert.addAction("Custom Seconds");
    alert.addCancelAction("Cancel");
    const idx = await alert.present();
    let updateInterval;
    if (idx !== -1) {
      if (idx < intervals.length) {
        updateInterval = intervals[idx].value;
      } else {
        const inputAlert = new Alert();
        inputAlert.title = "Custom Update Interval";
        inputAlert.message = "Please enter an interval (30-3600 seconds)";
        inputAlert.addTextField("Seconds", "300");
        inputAlert.addAction("OK");
        inputAlert.addCancelAction("Cancel");
        const inputResult = await inputAlert.present();
        if (inputResult === 0) {
          const inputValue = parseInt(inputAlert.textFieldValue(0));
          if (isNaN(inputValue) || inputValue < 30 || inputValue > 3600) {
            this.showNotification("Input Error", "Please enter a value between 30 and 3600 seconds");
            return;
          }
          updateInterval = inputValue;
        } else {
          return;
        }
      }
      const settings = await WidgetSettings.getInstance();
      settings.updateInterval = updateInterval;
      await settings.save();
      this.showNotification("Updated", `Update interval set to ${updateInterval} seconds`);
    }
  }

  static async updateData() {
    try {
      const vehicleData = await vehicleCache.getInstance();
      const attributes = await JLRConnectAPI.getVehicleAttributes();
      const status = await JLRConnectAPI.getVehicleStatus();
      const position = await JLRConnectAPI.getVehiclePosition();
      if (attributes && status && position) {
        vehicleData.attributes = attributes;
        vehicleData.status = status;
        vehicleData.position = position;
        vehicleData.lastUpdate = new Date().toLocaleString('en-US');
        vehicleData.timestamp = Date.now();
        await vehicleData.save();
        await this.renderWidget();
        await this.showNotification("Update Successful", `Updated vehicle info:\n${attributes.vehicleBrand} ${attributes.nickname || attributes.vehicleType}\nUpdated at: ${new Date().toLocaleString('en-US')}`);
      } else {
        log("Update failed: Request failed");
        this.showNotification("Error", "Update failed: Request failed");
      }
    } catch (error) {
      log(`Update failed: ${error.message}`);
      this.showNotification("Error", `Update failed: ${error.message}`);
    }
  }

  static async previewWidget() {
    try {
      const alert = new Alert();
      alert.title = "Select Preview Size";
      alert.message = "Please select the widget size to preview";
      alert.addAction("Circular Lock Screen Widget");
      alert.addAction("Inline Lock Screen Widget");
      alert.addAction("Rectangular Lock Screen Widget");
      alert.addAction("Small Size");
      alert.addAction("Medium Size");
      alert.addAction("Large Size");
      alert.addAction("Extra Large Size");
      alert.addCancelAction("Cancel");
      const idx = await alert.present();
      if (idx !== -1) {
        const widget = await createWidget(true, [
          'accessoryCircular',
          'accessoryInline',
          'accessoryRectangular',
          'small',
          'medium',
          'large',
          'extraLarge'
        ][idx]);
        switch (idx) {
          case 0: await widget.presentAccessoryCircular(); break;
          case 1: await widget.presentAccessoryInline(); break;
          case 2: await widget.presentAccessoryRectangular(); break;
          case 3: await widget.presentSmall(); break;
          case 4: await widget.presentMedium(); break;
          case 5: await widget.presentLarge(); break;
          case 6:
            this.showNotification("Not Supported", "Extra Large widget preview not supported");
            break;
        }
      }
    } catch (error) {
      this.showNotification("Error", `Preview failed: ${error.message}`);
    }
  }

  static async showDataManager() {
    const alert = new Alert();
    alert.title = "Data Management";
    alert.message = "Select an action";
    alert.addAction("Update Interval");
    alert.addAction("Update Data");
    alert.addAction("Clear Cache");
    alert.addAction("View Cache [Debug Only]");
    alert.addAction("View Account [Debug Only]");
    alert.addAction("View Settings [Debug Only]");
    alert.addCancelAction("Back");
    const idx = await alert.presentSheet();
    if (idx === -1) {
      await this.showMainMenu();
      return;
    }
    switch (idx) {
      case 0: await this.showUpdateIntervalSelect(); break;
      case 1: await this.updateData(); break;
      case 2: await this.clearCache(); break;
      case 3: await this.viewCache(); break;
      case 4: await this.viewAccount(); break;
      case 5: await this.viewSettings(); break;
    }
    await this.showDataManager();
  }

  static async clearCache() {
    try {
      const fm = FileManager.local();
      const cachePath = fm.joinPath(fm.documentsDirectory(), VersionManager.getFileName('cache'));
      const accountPath = fm.joinPath(fm.documentsDirectory(), VersionManager.getFileName('account'));
      const existingFiles = [];
      if (fm.fileExists(cachePath)) {
        existingFiles.push(`Cache file: ${VersionManager.getFileName('cache')}`);
      }
      if (fm.fileExists(accountPath)) {
        existingFiles.push(`Account file: ${VersionManager.getFileName('account')}`);
      }
      if (existingFiles.length === 0) {
        await this.showNotification("Note", "No cache files found");
        return;
      }
      const alert = new Alert();
      alert.title = "Clear Cache";
      alert.message = "Found the following files:\n" + existingFiles.join('\n') + "\n\nAre you sure you want to delete these files?";
      alert.addAction("OK");
      alert.addCancelAction("Cancel");
      const userChoice = await alert.presentAlert();
      if (userChoice === 0) {
        if (fm.fileExists(cachePath)) {
          fm.remove(cachePath);
        }
        if (fm.fileExists(accountPath)) {
          fm.remove(accountPath);
        }
        const widget = await createWidget(false);
        Script.setWidget(widget);
        await this.showNotification("Cleared", `Deleted files:\n${existingFiles.join('\n')}`);
      }
    } catch (error) {
      await this.showNotification("Error", `Failed to clear cache: ${error.message}`);
    }
  }

  static async viewCache() {
    try {
      const cacheData = await vehicleCache.getInstance();
      const formattedLines = Utils.formatObject(cacheData);
      await this.showNotification("Cache Content", formattedLines.length > 0 ? formattedLines.join('\n') : "No valid data");
    } catch (error) {
      console.error("View cache failed:", error);
      await this.showNotification("Error", `Failed to read cache: ${error.message}`);
    }
  }

  static async viewAccount() {
    try {
      const account = await AccountInfo.getInstance();
      const formattedLines = Utils.formatObject(account);
      await this.showNotification("Account Content", formattedLines.length > 0 ? formattedLines.join('\n') : "No valid data");
    } catch (error) {
      console.error("View account failed:", error);
      await this.showNotification("Error", `Failed to read account: ${error.message}`);
    }
  }

  static async viewSettings() {
    try {
      const settings = await WidgetSettings.getInstance();
      const formattedLines = Utils.formatObject(settings);
      await this.showNotification("Settings Content", formattedLines.length > 0 ? formattedLines.join('\n') : "No valid data");
    } catch (error) {
      console.error("View settings failed:", error);
      await this.showNotification("Error", `Failed to read settings: ${error.message}`);
    }
  }

  static async showNotification(title, message) {
    const alert = new Alert();
    alert.title = title;
    alert.message = message;
    alert.addAction("OK");
    await alert.presentAlert();
  }

  static async showWidgetSettings() {
    const alert = new Alert();
    alert.title = "Widget Settings";
    alert.message = "Select an action";
    alert.addAction("Manual Preview");
    alert.addAction("Manual Render");
    alert.addAction("Background Settings");
    alert.addCancelAction("Back");
    const idx = await alert.presentSheet();
    if (idx === -1) {
      await this.showMainMenu();
      return;
    }
    switch (idx) {
      case 0: await this.previewWidget(); break;
      case 1: await this.renderWidget(true, null, true); break;
      case 2: await this.setBackgroundImage(); break;
    }
    await this.showWidgetSettings();
  }

  static async renderWidget(useCache = true, family = null, showNotification = false, noErrorInterrupt = false) {
    try {
      const widget = await createWidget(useCache, family);
      if (noErrorInterrupt && !widget) {
        return;
      }
      Script.setWidget(widget);
      if (showNotification && !config.runsInWidget) {
        await this.showNotification("Rendered", "Widget successfully rendered");
      }
    } catch (error) {
      if (!config.runsInWidget) {
        this.showNotification("Error", `Render failed: ${error.message}`);
      }
    }
  }

  static async setBackgroundBlur() {
    const alert = new Alert();
    alert.title = "Set Background Darkness";
    alert.message = "Please select a preset or enter a custom value (0-100)";
    alert.addAction("Light (25%)");
    alert.addAction("Medium (50%)");
    alert.addAction("Dark (75%)");
    alert.addAction("Custom Value");
    alert.addCancelAction("Cancel");
    const choice = await alert.present();
    if (choice === 3) {
      return await this.setCustomBlur();
    } else if (choice !== -1) {
      const presetValues = [25, 50, 75];
      const blurValue = presetValues[choice];
      const settings = await WidgetSettings.getInstance();
      settings.backgroundBlur = blurValue;
      await settings.save();
      await this.renderWidget();
      await this.showNotification("Updated", `Background darkness set to ${blurValue}`);
    }
  }

  static async setCustomBlur() {
    const alert = new Alert();
    alert.title = "Custom Darkness";
    alert.message = "Enter background darkness (0-100)\n0 means original image, 100 means darkest";
    const settings = await WidgetSettings.getInstance();
    let currentBlur = settings.backgroundBlur;
    alert.addTextField("Darkness", currentBlur.toString());
    alert.addAction("OK");
    alert.addCancelAction("Cancel");
    const idx = await alert.present();
    if (idx === 0) {
      const blurValue = parseInt(alert.textFieldValue(0));
      if (isNaN(blurValue) || blurValue < 0 || blurValue > 100) {
        await this.showNotification("Input Error", "Please enter a value between 0 and 100");
        return;
      }
      const settings = await WidgetSettings.getInstance();
      settings.backgroundBlur = blurValue;
      await settings.save();
      await this.renderWidget();
      await this.showNotification("Updated", `Background darkness set to ${blurValue}`);
    }
  }

  static async setBackgroundImage() {
    try {
      const imgPicker = new Alert();
      imgPicker.title = "Set Background Image";
      imgPicker.message = "Please choose an option";
      imgPicker.addAction("Choose from Photos");
      imgPicker.addAction("Choose from iCloud");
      imgPicker.addAction("Set Darkness");
      imgPicker.addAction("Reset to Default Background");
      imgPicker.addCancelAction("Cancel");
      const choice = await imgPicker.present();
      const fm = FileManager.local();
      const bgPath = fm.joinPath(fm.documentsDirectory(), VersionManager.getFileName('background').replace('.json', '.jpg'));
      if (choice === 0) {
        const img = await Photos.fromLibrary();
        fm.writeImage(bgPath, img);
        await this.setBackgroundBlur();
        await this.renderWidget();
      } else if (choice === 1) {
        const iCloud = FileManager.iCloud();
        const baseDir = iCloud.documentsDirectory();
        const files = iCloud.listContents(baseDir).filter(file =>
          file.toLowerCase().endsWith('.jpg') ||
          file.toLowerCase().endsWith('.jpeg') ||
          file.toLowerCase().endsWith('.png')
        );
        if (files.length === 0) {
          await this.showNotification("Not Found", "Please place image files in the Scriptable folder in iCloud Drive first");
          return;
        }
        const fileAlert = new Alert();
        fileAlert.title = "Select Image";
        fileAlert.message = "Please select the image file to use";
        files.forEach(file => { fileAlert.addAction(file); });
        fileAlert.addCancelAction("Cancel");
        const fileIdx = await fileAlert.present();
        if (fileIdx !== -1) {
          const selectedFile = files[fileIdx];
          const filePath = iCloud.joinPath(baseDir, selectedFile);
          if (iCloud.fileExists(filePath)) {
            const imageData = iCloud.readImage(filePath);
            if (imageData) {
              fm.writeImage(bgPath, imageData);
              await this.setBackgroundBlur();
            } else {
              throw new Error("Cannot read the selected image");
            }
          }
        }
      } else if (choice === 2) {
        if (!fm.fileExists(bgPath)) {
          await this.showNotification("Error", "Please set a background image first");
          return;
        }
        await this.setBackgroundBlur();
      } else if (choice === 3) {
        if (fm.fileExists(bgPath)) {
          fm.remove(bgPath);
        }
        const settings = await WidgetSettings.getInstance();
        settings.backgroundBlur = 0;
        await settings.save();
        await this.renderWidget();
        await this.showNotification("Reset", "Default background restored");
      }
    } catch (error) {
      await this.showNotification("Error", `Setting background failed: ${error.message}`);
    }
  }

  static async checkUpdate() {
    try {
      const settings = await WidgetSettings.getInstance();
      const alert = new Alert();
      alert.title = "Update Settings";
      alert.message = `Auto Update: ${settings.autoUpdate ? 'Enabled' : 'Disabled'}\nUpdate Channel: ${settings.autoUpdateType === 'stable' ? 'Stable Version' : settings.autoUpdateType === 'beta' ? 'Beta Version' : 'Alpha Version'}`;
      alert.addAction("Check for Updates");
      alert.addAction("Auto Update Settings");
      alert.addCancelAction("Back");
      const choice = await alert.presentSheet();
      if (choice === -1) {
        await this.showMainMenu();
        return;
      }
      switch (choice) {
        case 0: await this.performUpdateCheck(); break;
        case 1: await this.showAutoUpdateSettings(); break;
      }
      await this.checkUpdate();
    } catch (error) {
      await this.showNotification("Error", `Update settings error: ${error.message}`);
    }
  }

  static async performUpdateCheck() {
    try {
      const versionAlert = new Alert();
      const { version: currentVersion, type: currentVersionType } = VersionManager.getVersionInfo();
      versionAlert.title = "Select Version";
      versionAlert.message = `Current version: ${currentVersion} ${currentVersionType}\n\n` +
        "Stable Version: Fully tested stable version\n" +
        "Alpha Version: Contains the latest features but may be buggy\n" +
        "Beta Version: Public beta with major testing complete\n\n" +
        "* Alpha and Beta versions may have issues\nIf features do not work correctly, please switch to Stable Version";
      versionAlert.addAction("Stable Version");
      versionAlert.addAction("Alpha Version");
      versionAlert.addAction("Beta Version");
      versionAlert.addCancelAction("Cancel");
      const choice = await versionAlert.present();
      if (choice !== -1) {
        const account = await AccountInfo.getInstance();
        if (!account.refreshToken) {
          throw new Error("No valid authentication info found, please login");
        }
        let updateUrl;
        let versionType;
        switch (choice) {
          case 0: updateUrl = `${API_CONFIG.extendUrl}/scriptable/update/stable`; versionType = "Stable Version"; break;
          case 1: updateUrl = `${API_CONFIG.extendUrl}/scriptable/update/alpha`; versionType = "Alpha Version"; break;
          case 2: updateUrl = `${API_CONFIG.extendUrl}/scriptable/update/beta`; versionType = "Beta Version"; break;
        }
        const request = new Request(updateUrl);
        request.method = "POST";
        request.headers = {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${account.refreshToken}`,
          "Authorization-MAIL": `${account.username}`
        };
        request.timeoutInterval = 10;
        request.body = JSON.stringify({
          currentVersion: currentVersion,
          currentVersionType: currentVersionType,
          platform: Device.systemName(),
          deviceModel: Device.model(),
          systemVersion: Device.systemVersion(),
        });
        const response = await request.loadString();
        const updateInfo = JSON.parse(response);
        const alert2 = new Alert();
        if (updateInfo.hasUpdate) {
          alert2.title = "New Version Available";
          alert2.message = `Current version: ${currentVersion} ${currentVersionType}\n` +
            `Latest version: ${updateInfo.latestVersion} ${updateInfo.latestVersionType}\n\n` +
            `Changelog:\n${updateInfo.changelog}`;
          alert2.addAction("Update Now");
          alert2.addCancelAction("Cancel");
        } else {
          alert2.title = "You're Up-to-Date";
          alert2.message = `Current version: ${currentVersion} ${currentVersionType}`;
          alert2.addAction("Redownload");
          alert2.addCancelAction("Cancel");
        }
        const userChoice = await alert2.present();
        if (userChoice === 0) {
          const newScript = updateInfo.scriptContent;
          const fm = FileManager.local();
          const currentPath = module.filename;
          const backupPath = currentPath + '.backup';
          if (fm.fileExists(backupPath)) {
            fm.remove(backupPath);
          }
          fm.copy(currentPath, backupPath);
          fm.writeString(currentPath, newScript);
          this.showNotification("Updated", `Script updated to latest ${versionType}. Please rerun the script`);
          Script.complete();
        }
      }
    } catch (error) {
      this.showNotification("Error", `Update check failed: ${error.message}`);
    }
  }

  static async showAutoUpdateSettings() {
    const settings = await WidgetSettings.getInstance();
    const alert = new Alert();
    alert.title = "Auto Update Settings";
    alert.message = "Set auto update options";
    alert.addAction(settings.autoUpdate ? "Disable Auto Update" : "Enable Auto Update");
    if (settings.autoUpdate) {
      alert.addAction("Update Channel Settings");
    }
    alert.addCancelAction("Back");
    const choice = await alert.presentSheet();
    if (choice === -1) { return; }
    if (choice === 0) {
      settings.autoUpdate = !settings.autoUpdate;
      await settings.save();
      await this.showNotification("Updated", `Auto update ${settings.autoUpdate ? 'Enabled' : 'Disabled'}`);
    } else if (choice === 1 && settings.autoUpdate) {
      await this.showUpdateChannelSettings();
    }
  }

  static async showUpdateChannelSettings() {
    const settings = await WidgetSettings.getInstance();
    const alert = new Alert();
    alert.title = "Update Channel Settings";
    alert.message = "Select the update channel for auto updates\n\n" +
      "Stable Version: Fully tested stable version\n" +
      "Beta Version: Public beta version\n" +
      "Alpha Version: Latest features but may be unstable";
    alert.addAction("Stable Version");
    alert.addAction("Beta Version");
    alert.addAction("Alpha Version");
    alert.addCancelAction("Back");
    const choice = await alert.presentSheet();
    if (choice !== -1) {
      const channels = ['stable', 'beta', 'alpha'];
      settings.autoUpdateType = channels[choice];
      await settings.save();
      await this.showNotification("Updated", `Update channel set to ${choice === 0 ? 'Stable Version' : choice === 1 ? 'Beta Version' : 'Alpha Version'}`);
    }
  }

  static async showCopyright() {
    await this.showNotification("License Statement",
      "This project is an open source project initiated by @xuyuanfang under the GPL-3.0 license.\n\n" +
      "Repository:\nhttps://github.com/xuyuanfang/WidgetKitForCar\n\n" +
      "Feel free to visit the repository for the latest version, submit feedback, or contribute.\n" +
      "You may use, modify, and distribute this project freely, but derivative works must remain open-source under the same license.\n\n" +
      "Disclaimer: Land Rover and its logo are registered trademarks of Jaguar Land Rover Limited.\n" +
      "This project is an unofficial tool and is not affiliated with Jaguar Land Rover Limited.");
  }
}

// Main widget creation function
async function createWidget(useCache = false, family = null) {
  log("Starting widget creation");
  try {
    const settings = await WidgetSettings.getInstance();
    if (settings.autoUpdate) {
      const fm = FileManager.local();
      const lastCheckPath = fm.joinPath(fm.documentsDirectory(), VersionManager.getFileName('lastUpdateCheck'));
      let lastCheckTime = 0;
      if (fm.fileExists(lastCheckPath)) {
        lastCheckTime = parseInt(fm.readString(lastCheckPath));
      }
      const now = Date.now();
      if (now - lastCheckTime > 24 * 60 * 60 * 1000) {
        log("Performing auto update check...");
        const account = await AccountInfo.getInstance();
        if (account.refreshToken) {
          const { version: currentVersion, type: currentVersionType } = VersionManager.getVersionInfo();
          const updateUrl = `${API_CONFIG.extendUrl}/scriptable/update/${settings.autoUpdateType}`;
          const request = new Request(updateUrl);
          request.method = "POST";
          request.headers = {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${account.refreshToken}`,
            "Authorization-MAIL": `${account.username}`
          };
          request.timeoutInterval = 10;
          request.body = JSON.stringify({
            currentVersion: currentVersion,
            currentVersionType: currentVersionType,
            platform: Device.systemName(),
            deviceModel: Device.model(),
            systemVersion: Device.systemVersion(),
          });
          const response = await request.loadString();
          const updateInfo = JSON.parse(response);
          if (updateInfo.hasUpdate) {
            log("New version found, updating...");
            const currentPath = module.filename;
            const backupPath = currentPath + '.backup';
            if (fm.fileExists(backupPath)) {
              fm.remove(backupPath);
            }
            fm.copy(currentPath, backupPath);
            fm.writeString(currentPath, updateInfo.scriptContent);
            log("Update complete, will take effect next run");
          }
        }
        fm.writeString(lastCheckPath, now.toString());
      }
    }
  } catch (error) {
    log(`Auto update check failed: ${error.message}`);
  }
  log(`Input widget size: ${family}`);
  log(`System widget size: ${config.widgetFamily}`);
  const widget = new ListWidget();
  if (family === 'small' || family === 'medium' || family === 'large') {
    const bgImage = await Utils.getBackgroundImage();
    if (bgImage) {
      widget.backgroundImage = bgImage;
    } else {
      const gradient = new LinearGradient();
      gradient.startPoint = new Point(0, 0);
      gradient.endPoint = new Point(1, 1);
      gradient.colors = [
        new Color("#1C1C1E"),
        new Color("#2C2C2E"),
        new Color("#3C3C3E")
      ];
      gradient.locations = [0.0, 0.5, 1.0];
      widget.backgroundGradient = gradient;
    }
  }
  const widgetFamily = family || config.widgetFamily || 'medium';
  log(`Final widget size used: ${widgetFamily}`);
  try {
    const account = await AccountInfo.getInstance();
    log("Loading configuration");
    let widgetSize = family || args.widgetFamily || 'medium';
    log(`Using widget size: ${widgetSize}`);
    if (!account.username || !account.password) {
      log("Configuration not found");
      const text = widget.addText("Please login and set up");
      text.textColor = Color.white();
      text.font = Font.mediumSystemFont(14);
      return widget;
    }
    let vehicleData = await vehicleCache.getInstance();
    if (!useCache) {
      try {
        log("Attempting to fetch new data");
        const attributes = await JLRConnectAPI.getVehicleAttributes();
        const status = await JLRConnectAPI.getVehicleStatus();
        const position = await JLRConnectAPI.getVehiclePosition();
        vehicleData.attributes = attributes;
        vehicleData.status = status;
        vehicleData.position = position;
        vehicleData.lastUpdate = new Date().toLocaleString('en-US');
        vehicleData.timestamp = Date.now();
        await vehicleData.save();
      } catch (error) {
        log("Fetching new data failed, using cache or default values");
        log(`Error: ${error.message}`);
      }
    }
    if (vehicleData && vehicleData.status && vehicleData.attributes && vehicleData.position) {
      const status = vehicleData.status;
      const attributes = vehicleData.attributes;
      const position = vehicleData.position;
      const mainStack = widget.addStack();
      mainStack.layoutVertically();
      mainStack.spacing = widgetFamily === 'small' ? 4 : 6;
      if (widgetFamily === 'accessoryCircular') {
        const fuelLevel = status.vehicleStatus.coreStatus.find(s => s.key === "FUEL_LEVEL_PERC").value;
        const fuelText = mainStack.addText(`${fuelLevel}%`);
        fuelText.textColor = new Color(fuelLevel > 20 ? '#34C759' : '#FF3B30');
        fuelText.font = Font.boldSystemFont(20);
        fuelText.centerAlignText();
        const distanceToEmpty = status.vehicleStatus.coreStatus.find(s => s.key === "DISTANCE_TO_EMPTY_FUEL").value;
        const rangeText = mainStack.addText(`Range ${distanceToEmpty}km`);
        rangeText.textColor = Color.white();
        rangeText.font = Font.systemFont(10);
        rangeText.centerAlignText();
      } else if (widgetFamily === 'accessoryInline') {
        const fuelLevel = status.vehicleStatus.coreStatus.find(s => s.key === "FUEL_LEVEL_PERC").value;
        const distanceToEmpty = status.vehicleStatus.coreStatus.find(s => s.key === "DISTANCE_TO_EMPTY_FUEL").value;
        const title = mainStack.addText(`Fuel ${fuelLevel}% (${distanceToEmpty} km)`);
        title.textColor = Color.white();
        title.font = Font.boldSystemFont(13);
        title.lineLimit = 1;
      } else if (widgetFamily === 'accessoryRectangular') {
        const contentStack = mainStack.addStack();
        contentStack.layoutHorizontally();
        contentStack.spacing = 4;
        const leftStack = contentStack.addStack();
        leftStack.layoutVertically();
        leftStack.spacing = 2;
        const fuelLevel = status.vehicleStatus.coreStatus.find(s => s.key === "FUEL_LEVEL_PERC").value;
        const fuelText = leftStack.addText(`${fuelLevel}%`);
        fuelText.textColor = new Color(fuelLevel > 20 ? '#34C759' : '#FF3B30');
        fuelText.font = Font.boldSystemFont(26);
        fuelText.lineLimit = 1;
        leftStack.addSpacer(1);
        const distanceToEmpty = status.vehicleStatus.coreStatus.find(s => s.key === "DISTANCE_TO_EMPTY_FUEL").value;
        const rangeText = leftStack.addText(`Range ${distanceToEmpty}km`);
        rangeText.textColor = Color.white();
        rangeText.font = Font.systemFont(13);
        rangeText.lineLimit = 1;
        contentStack.addSpacer();
        const rightStack = contentStack.addStack();
        rightStack.layoutVertically();
        rightStack.spacing = 3;
        const isLocked = status.vehicleStatus.coreStatus.find(s => s.key === "DOOR_IS_ALL_DOORS_LOCKED").value === "TRUE";
        const lockText = rightStack.addText(isLocked ? 'Locked' : 'Unlocked');
        lockText.textColor = isLocked ? new Color('#34C759') : new Color('#FF3B30');
        lockText.font = Font.systemFont(13);
        lockText.lineLimit = 1;
        const doorsStatus = Object.values({
          frontLeft: status.vehicleStatus.coreStatus.find(s => s.key === "DOOR_FRONT_LEFT_POSITION").value,
          frontRight: status.vehicleStatus.coreStatus.find(s => s.key === "DOOR_FRONT_RIGHT_POSITION").value,
          rearLeft: status.vehicleStatus.coreStatus.find(s => s.key === "DOOR_REAR_LEFT_POSITION").value,
          rearRight: status.vehicleStatus.coreStatus.find(s => s.key === "DOOR_REAR_RIGHT_POSITION").value,
          hood: status.vehicleStatus.coreStatus.find(s => s.key === "DOOR_ENGINE_HOOD_POSITION").value,
          boot: status.vehicleStatus.coreStatus.find(s => s.key === "DOOR_BOOT_POSITION").value
        }).every(v => v === "CLOSED");
        const doorText = rightStack.addText(doorsStatus ? 'Doors Closed' : 'Doors Open');
        doorText.textColor = doorsStatus ? new Color('#34C759') : new Color('#FF3B30');
        doorText.font = Font.systemFont(13);
        doorText.lineLimit = 1;
        const windowsStatus = Object.values({
          frontLeft: status.vehicleStatus.coreStatus.find(s => s.key === "WINDOW_FRONT_LEFT_STATUS").value,
          frontRight: status.vehicleStatus.coreStatus.find(s => s.key === "WINDOW_FRONT_RIGHT_STATUS").value,
          rearLeft: status.vehicleStatus.coreStatus.find(s => s.key === "WINDOW_REAR_LEFT_STATUS").value,
          rearRight: status.vehicleStatus.coreStatus.find(s => s.key === "WINDOW_REAR_RIGHT_STATUS").value
        }).every(v => v === "CLOSED");
        const windowText = rightStack.addText(windowsStatus ? 'Windows Closed' : 'Windows Open');
        windowText.textColor = windowsStatus ? new Color('#34C759') : new Color('#FF3B30');
        windowText.font = Font.systemFont(13);
        windowText.lineLimit = 1;
      } else if (widgetFamily === 'small') {
        const title = mainStack.addText(attributes.nickname || "My Car");
        title.textColor = Color.white();
        title.font = Font.boldSystemFont(20);
        title.lineLimit = 1;
        mainStack.addSpacer(2);
        const fuelLevel = status.vehicleStatus.coreStatus.find(s => s.key === "FUEL_LEVEL_PERC").value;
        const fuelText = mainStack.addText(`${fuelLevel}%`);
        fuelText.textColor = new Color(fuelLevel > 20 ? '#34C759' : '#FF3B30');
        fuelText.font = Font.boldSystemFont(30);
        fuelText.centerAlignText();
        const distanceToEmpty = status.vehicleStatus.coreStatus.find(s => s.key === "DISTANCE_TO_EMPTY_FUEL").value;
        const rangeText = mainStack.addText(`Range ${distanceToEmpty}km`);
        rangeText.textColor = Color.white();
        rangeText.font = Font.systemFont(16);
        rangeText.centerAlignText();
      } else if (widgetFamily === 'medium') {
        const headerStack = mainStack.addStack();
        headerStack.layoutHorizontally();
        const title = headerStack.addText(attributes.nickname || "My Car");
        title.textColor = Color.white();
        title.font = Font.boldSystemFont(20);
        title.lineLimit = 1;
        headerStack.addSpacer();
        const fuelLevel = status.vehicleStatus.coreStatus.find(s => s.key === "FUEL_LEVEL_PERC").value;
        const fuelText = headerStack.addText(`${fuelLevel}%`);
        fuelText.textColor = new Color(fuelLevel > 20 ? '#34C759' : '#FF3B30');
        fuelText.font = Font.mediumSystemFont(20);
        const statusStack = mainStack.addStack();
        statusStack.layoutHorizontally();
        statusStack.spacing = 8;
        const leftStack = statusStack.addStack();
        leftStack.layoutVertically();
        leftStack.spacing = 2;
        const distanceToEmpty = status.vehicleStatus.coreStatus.find(s => s.key === "DISTANCE_TO_EMPTY_FUEL").value;
        const rangeText = leftStack.addText(`Range ${distanceToEmpty}km`);
        rangeText.textColor = Color.white();
        rangeText.font = Font.systemFont(16);
        rangeText.lineLimit = 1;
        const odometerKm = Math.floor(status.vehicleStatus.coreStatus.find(s => s.key === "ODOMETER").value / 1000);
        const mileageText = leftStack.addText(`Mileage ${odometerKm}km`);
        mileageText.textColor = Color.white();
        mileageText.font = Font.systemFont(16);
        mileageText.lineLimit = 1;
        statusStack.addSpacer();
        const rightStack = statusStack.addStack();
        rightStack.layoutVertically();
        rightStack.spacing = 2;
        const isLocked = status.vehicleStatus.coreStatus.find(s => s.key === "DOOR_IS_ALL_DOORS_LOCKED").value === "TRUE";
        const lockText = rightStack.addText(isLocked ? 'Locked' : 'Unlocked');
        lockText.textColor = isLocked ? new Color('#34C759') : new Color('#FF3B30');
        lockText.font = Font.systemFont(14);
        lockText.lineLimit = 1;
        const doorsStatus = Object.values({
          frontLeft: status.vehicleStatus.coreStatus.find(s => s.key === "DOOR_FRONT_LEFT_POSITION").value,
          frontRight: status.vehicleStatus.coreStatus.find(s => s.key === "DOOR_FRONT_RIGHT_POSITION").value,
          rearLeft: status.vehicleStatus.coreStatus.find(s => s.key === "DOOR_REAR_LEFT_POSITION").value,
          rearRight: status.vehicleStatus.coreStatus.find(s => s.key === "DOOR_REAR_RIGHT_POSITION").value,
          hood: status.vehicleStatus.coreStatus.find(s => s.key === "DOOR_ENGINE_HOOD_POSITION").value,
          boot: status.vehicleStatus.coreStatus.find(s => s.key === "DOOR_BOOT_POSITION").value
        }).every(v => v === "CLOSED");
        const doorText = rightStack.addText(doorsStatus ? 'Doors Closed' : 'Doors Open');
        doorText.textColor = doorsStatus ? new Color('#34C759') : new Color('#FF3B30');
        doorText.font = Font.systemFont(14);
        doorText.lineLimit = 1;
        const windowsStatus = Object.values({
          frontLeft: status.vehicleStatus.coreStatus.find(s => s.key === "WINDOW_FRONT_LEFT_STATUS").value,
          frontRight: status.vehicleStatus.coreStatus.find(s => s.key === "WINDOW_FRONT_RIGHT_STATUS").value,
          rearLeft: status.vehicleStatus.coreStatus.find(s => s.key === "WINDOW_REAR_LEFT_STATUS").value,
          rearRight: status.vehicleStatus.coreStatus.find(s => s.key === "WINDOW_REAR_RIGHT_STATUS").value
        }).every(v => v === "CLOSED");
        const windowText = rightStack.addText(windowsStatus ? 'Windows Closed' : 'Windows Open');
        windowText.textColor = windowsStatus ? new Color('#34C759') : new Color('#FF3B30');
        windowText.font = Font.systemFont(14);
        windowText.lineLimit = 1;
      } else if (widgetFamily === 'large') {
        const headerStack = mainStack.addStack();
        headerStack.layoutHorizontally();
        const title = headerStack.addText(attributes.nickname || "My Car");
        title.textColor = Color.white();
        title.font = Font.boldSystemFont(20);
        title.lineLimit = 1;
        headerStack.addSpacer();
        const fuelStack = headerStack.addStack();
        fuelStack.layoutVertically();
        fuelStack.spacing = 2;
        const fuelLevel = status.vehicleStatus.coreStatus.find(s => s.key === "FUEL_LEVEL_PERC").value;
        const fuelText = fuelStack.addText(`${fuelLevel}%`);
        fuelText.textColor = new Color(fuelLevel > 20 ? '#34C759' : '#FF3B30');
        fuelText.font = Font.mediumSystemFont(20);
        fuelText.rightAlignText();
        const distanceToEmpty = status.vehicleStatus.coreStatus.find(s => s.key === "DISTANCE_TO_EMPTY_FUEL").value;
        const rangeText = fuelStack.addText(`Range ${distanceToEmpty}km`);
        rangeText.textColor = Color.white();
        rangeText.font = Font.systemFont(12);
        rangeText.rightAlignText();
        const basicStack = mainStack.addStack();
        basicStack.layoutVertically();
        basicStack.spacing = 4;
        const isLocked = status.vehicleStatus.coreStatus.find(s => s.key === "DOOR_IS_ALL_DOORS_LOCKED").value === "TRUE";
        const lockText = basicStack.addText(`Vehicle ${isLocked ? 'Locked' : 'Unlocked'}`);
        lockText.textColor = isLocked ? new Color('#34C759') : new Color('#FF3B30');
        lockText.font = Font.systemFont(12);
        lockText.lineLimit = 1;
        const odometerKm = Math.floor(status.vehicleStatus.coreStatus.find(s => s.key === "ODOMETER").value / 1000);
        const serviceKm = status.vehicleStatus.coreStatus.find(s => s.key === "EXT_KILOMETERS_TO_SERVICE").value;
        const mileageText = basicStack.addText(`Mileage ${odometerKm}km    To service ${serviceKm}km`);
        mileageText.textColor = Color.white();
        mileageText.font = Font.systemFont(12);
        mileageText.lineLimit = 1;
        const statusStack = mainStack.addStack();
        statusStack.layoutVertically();
        statusStack.spacing = 4;
        const doorTitle = statusStack.addText("Door Status");
        doorTitle.textColor = Color.white();
        doorTitle.font = Font.boldSystemFont(12);
        const frontDoorText = statusStack.addText(
          `Left Front: ${status.vehicleStatus.coreStatus.find(s => s.key === "DOOR_FRONT_LEFT_POSITION").value === "CLOSED" ? "Closed" : "Open"}    ` +
          `Right Front: ${status.vehicleStatus.coreStatus.find(s => s.key === "DOOR_FRONT_RIGHT_POSITION").value === "CLOSED" ? "Closed" : "Open"}`
        );
        frontDoorText.textColor = (status.vehicleStatus.coreStatus.find(s => s.key === "DOOR_FRONT_LEFT_POSITION").value === "CLOSED" &&
          status.vehicleStatus.coreStatus.find(s => s.key === "DOOR_FRONT_RIGHT_POSITION").value === "CLOSED") ?
          new Color('#34C759') : new Color('#FF3B30');
        frontDoorText.font = Font.systemFont(12);
        frontDoorText.lineLimit = 1;
        const rearDoorText = statusStack.addText(
          `Left Rear: ${status.vehicleStatus.coreStatus.find(s => s.key === "DOOR_REAR_LEFT_POSITION").value === "CLOSED" ? "Closed" : "Open"}    ` +
          `Right Rear: ${status.vehicleStatus.coreStatus.find(s => s.key === "DOOR_REAR_RIGHT_POSITION").value === "CLOSED" ? "Closed" : "Open"}`
        );
        rearDoorText.textColor = (status.vehicleStatus.coreStatus.find(s => s.key === "DOOR_REAR_LEFT_POSITION").value === "CLOSED" &&
          status.vehicleStatus.coreStatus.find(s => s.key === "DOOR_REAR_RIGHT_POSITION").value === "CLOSED") ?
          new Color('#34C759') : new Color('#FF3B30');
        rearDoorText.font = Font.systemFont(12);
        rearDoorText.lineLimit = 1;
        const otherDoorsText = statusStack.addText(
          `Hood: ${status.vehicleStatus.coreStatus.find(s => s.key === "DOOR_ENGINE_HOOD_POSITION").value === "CLOSED" ? "Closed" : "Open"}    ` +
          `Trunk: ${status.vehicleStatus.coreStatus.find(s => s.key === "DOOR_BOOT_POSITION").value === "CLOSED" ? "Closed" : "Open"}`
        );
        otherDoorsText.textColor = (status.vehicleStatus.coreStatus.find(s => s.key === "DOOR_ENGINE_HOOD_POSITION").value === "CLOSED" &&
          status.vehicleStatus.coreStatus.find(s => s.key === "DOOR_BOOT_POSITION").value === "CLOSED") ?
          new Color('#34C759') : new Color('#FF3B30');
        otherDoorsText.font = Font.systemFont(12);
        otherDoorsText.lineLimit = 1;
        statusStack.addSpacer(4);
        const windowTitle = statusStack.addText("Window Status");
        windowTitle.textColor = Color.white();
        windowTitle.font = Font.boldSystemFont(12);
        const frontWindowText = statusStack.addText(
          `Left Front: ${status.vehicleStatus.coreStatus.find(s => s.key === "WINDOW_FRONT_LEFT_STATUS").value === "CLOSED" ? "Closed" : "Open"}    ` +
          `Right Front: ${status.vehicleStatus.coreStatus.find(s => s.key === "WINDOW_FRONT_RIGHT_STATUS").value === "CLOSED" ? "Closed" : "Open"}`
        );
        frontWindowText.textColor = (status.vehicleStatus.coreStatus.find(s => s.key === "WINDOW_FRONT_LEFT_STATUS").value === "CLOSED" &&
          status.vehicleStatus.coreStatus.find(s => s.key === "WINDOW_FRONT_RIGHT_STATUS").value === "CLOSED") ?
          new Color('#34C759') : new Color('#FF3B30');
        frontWindowText.font = Font.systemFont(12);
        frontWindowText.lineLimit = 1;
        const rearWindowText = statusStack.addText(
          `Left Rear: ${status.vehicleStatus.coreStatus.find(s => s.key === "WINDOW_REAR_LEFT_STATUS").value === "CLOSED" ? "Closed" : "Open"}    ` +
          `Right Rear: ${status.vehicleStatus.coreStatus.find(s => s.key === "WINDOW_REAR_RIGHT_STATUS").value === "CLOSED" ? "Closed" : "Open"}`
        );
        rearWindowText.textColor = (status.vehicleStatus.coreStatus.find(s => s.key === "WINDOW_REAR_LEFT_STATUS").value === "CLOSED" &&
          status.vehicleStatus.coreStatus.find(s => s.key === "WINDOW_REAR_RIGHT_STATUS").value === "CLOSED") ?
          new Color('#34C759') : new Color('#FF3B30');
        rearWindowText.font = Font.systemFont(12);
        rearWindowText.lineLimit = 1;
        statusStack.addSpacer(4);
        const tyrePressures = {
          FL: status.vehicleStatus.coreStatus.find(s => s.key === "TYRE_PRESSURE_FRONT_LEFT").value,
          FR: status.vehicleStatus.coreStatus.find(s => s.key === "TYRE_PRESSURE_FRONT_RIGHT").value,
          RL: status.vehicleStatus.coreStatus.find(s => s.key === "TYRE_PRESSURE_REAR_LEFT").value,
          RR: status.vehicleStatus.coreStatus.find(s => s.key === "TYRE_PRESSURE_REAR_RIGHT").value
        };
        const tyreTitle = statusStack.addText("Tyre Pressure Status");
        tyreTitle.textColor = Color.white();
        tyreTitle.font = Font.boldSystemFont(12);
        const frontTyreText = statusStack.addText(
          `Left Front: ${tyrePressures.FL}kPa    Right Front: ${tyrePressures.FR}kPa`
        );
        frontTyreText.textColor = Color.white();
        frontTyreText.font = Font.systemFont(12);
        frontTyreText.lineLimit = 1;
        const rearTyreText = statusStack.addText(
          `Left Rear: ${tyrePressures.RL}kPa    Right Rear: ${tyrePressures.RR}kPa`
        );
        rearTyreText.textColor = Color.white();
        rearTyreText.font = Font.systemFont(12);
        rearTyreText.lineLimit = 1;
      } else if (widgetFamily === 'extraLarge') {
        const text = mainStack.addText("Extra Large size not supported, please use a smaller size");
        text.textColor = Color.orange();
        text.font = Font.mediumSystemFont(14);
      }
      if (widgetFamily === 'small' || widgetFamily === 'medium' || widgetFamily === 'large') {
        mainStack.addSpacer();
        let serverTimeStr;
        try {
          const serverUpdateTime = Utils.findLatestTime(status);
          log(`Original server time: ${serverUpdateTime}`);
          if (!serverUpdateTime) {
            log('Full status data:');
            log(JSON.stringify(status, null, 2));
            serverTimeStr = `Failed to retrieve time`;
          } else {
            const matches = serverUpdateTime.match(/(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})\+/);
            if (matches) {
              const [_, year, month, day, hour, minute] = matches;
              const localHour = (parseInt(hour) + 8) % 24;
              serverTimeStr = `${month}-${day} ${localHour.toString().padStart(2, '0')}:${minute}`;
              log(`Parsed server time: ${serverTimeStr}`);
            } else {
              serverTimeStr = `Format error (${serverUpdateTime})`;
              log('Time format does not match');
            }
          }
        } catch (error) {
          log(`Error parsing server time: ${error.message}`);
          log(`Status data: ${JSON.stringify(status, null, 2)}`);
          serverTimeStr = `Parsing failed (${error.message})`;
        }
        const serverTimeStack = mainStack.addStack();
        serverTimeStack.backgroundColor = new Color("#000000", 0.3);
        serverTimeStack.cornerRadius = 4;
        serverTimeStack.setPadding(2, 4, 2, 4);
        const serverTimeText = serverTimeStack.addText(`Vehicle Data: ${serverTimeStr}`);
        serverTimeText.textColor = Color.gray();
        serverTimeText.font = Font.systemFont(widgetFamily === 'small' ? 9 : 11);
        serverTimeText.lineLimit = 1;
        serverTimeText.rightAlignText();
        const localUpdateStack = mainStack.addStack();
        localUpdateStack.backgroundColor = new Color("#000000", 0.3);
        localUpdateStack.cornerRadius = 4;
        localUpdateStack.setPadding(2, 4, 2, 4);
        const localUpdateText = localUpdateStack.addText(
          `Local Update: ${new Date(vehicleData.timestamp).toLocaleString('en-US', {
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            hourCycle: 'h23'
          }).replace(/\//g, '-')}`
        );
        localUpdateText.textColor = Color.gray();
        localUpdateText.font = Font.systemFont(widgetFamily === 'small' ? 9 : 11);
        localUpdateText.lineLimit = 1;
        localUpdateText.rightAlignText();
      }
      if (config.runsInWidget) {
        const settings = await WidgetSettings.getInstance();
        const updateInterval = settings.updateInterval || 300;
        widget.refreshAfterDate = new Date(Date.now() + updateInterval * 1000);
      }
    } else {
      const text = widget.addText("No data available");
      text.textColor = Color.gray();
      text.font = Font.systemFont(14);
    }
  } catch (error) {
    if (config.runsInApp) {
      log(`Widget creation error: ${error.message}`);
      const text = widget.addText(`${error.message}`);
      text.textColor = Color.orange();
      text.font = Font.mediumSystemFont(14);
    } else if (config.runsInWidget) {
      return null;
    }
  }
  return widget;
}

// Main function
async function main() {
  log("Connecting account");
  await JLRConnectAPI.connectByAccountOrToken();
  if (config.runsInWidget) {
    log("Running in widget");
    const widgetFamily = config.widgetFamily;
    log(`Widget Family: ${widgetFamily}`);
    const vehicleData = await vehicleCache.getInstance();
    if (!vehicleData) {
      log("No cached data, updating...");
      await MenuManager.renderWidget(false, widgetFamily);
    } else {
      const settings = await WidgetSettings.getInstance();
      const updateInterval = settings.updateInterval || 300;
      const timeSinceUpdate = Math.floor((Date.now() - vehicleData.timestamp) / 1000);
      if (timeSinceUpdate >= updateInterval) {
        log(`Data expired by ${Math.floor(timeSinceUpdate/60)} minutes, updating...`);
        await MenuManager.renderWidget(false, widgetFamily);
      } else {
        log(`Data not expired, remaining time: ${Math.floor((updateInterval - timeSinceUpdate)/60)} minutes`);
        await MenuManager.renderWidget(false, widgetFamily);
      }
    }
  } else if (config.runsInApp) {
    log("Running in app");
    await MenuManager.showMainMenu();
  }
}

await main();
log("Script execution complete");
Script.complete();
