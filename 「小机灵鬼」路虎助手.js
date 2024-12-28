// Variables used by Scriptable.
// These must be at the very top of the file. Do not edit.
// icon-color: orange; icon-glyph: car;
// Version: 1.0.3 Stable
// Update time: 2024-12-27 09:40:00
// Author: xuyuanfang
// Description: 「小机灵鬼」路虎助手
// Github: https://github.com/xuyuanfang/WidgetKitForCar
// License: GPL-3.0
// Changelog: 修复登录失效的问题, 重构代码, 优化菜单结构

// 版本管理
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

// 文件操作基类
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
            console.error(`读取${filename}失败:`, error);
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
            console.error(`保存${filename}失败:`, error);
        }
    }
}

// 账号相关配置
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
        super();  // 必须先调用 super()
        if (AccountInfo._instance) {
            return AccountInfo._instance;
        }
        AccountInfo._instance = this;
    }

    async _initializeFromStorage() {
        // 先尝试读取当前版本的账号信息
        const data = await this._loadFromFile('account');
        log(`当前版本账号信息: ${JSON.stringify(data)}`);

        // 如果当前版本没有账号信息，尝试从其他版本读取
        if (!data?.username) {
            log("当前版本没有账号信息，尝试读取其他版本");
            const otherVersionData = await this._tryLoadFromOtherVersions();
            log(`其他版本数据: ${JSON.stringify(otherVersionData)}`);

            if (otherVersionData) {
                log(`发现${otherVersionData.type}版本的账号信息`);
                // 如果找到其他版本的账号信息，提示用户
                const alert = new Alert();
                alert.title = "发现已保存的账号";
                alert.message = `在${otherVersionData.type}版本中发现已保存的账号信息：\n${otherVersionData.data.username}\n\n是否使用该账号登录？`;
                alert.addAction("使用");
                alert.addCancelAction("取消");

                const userChoice = await alert.present();
                log(`用户选择: ${userChoice}`);

                if (userChoice !== -1) {
                    log("用户同意使用已有账号，开始保存");
                    // 用户同意使用已有账号
                    await this._saveToFile('account', otherVersionData.data);
                    this._initializeFromData(otherVersionData.data);
                    return;
                }
            } else {
                log("未找到其他版本的账号信息");
            }
        } else {
            log("当前版本已有账号信息");
        }

        // 使用当前版本的数据或默认值初始化
        this._initializeFromData(data);
    }

    async _tryLoadFromOtherVersions() {
        const versions = ['Stable', 'Beta', 'Alpha'];
        const currentType = (await VersionManager.getVersionInfo()).type.toLowerCase();
        log(`当前版本类型: ${currentType}`);

        // 从其他版本中查找账号信息
        for (let type of versions) {
            type = type.toLowerCase();
            if (type === currentType) {
                log(`跳过当前版本: ${type}`);
                continue;
            }

            try {
                const fm = FileManager.local();
                const path = fm.joinPath(
                    fm.documentsDirectory(),
                    `jlr-${type}-account.json`
                );
                log(`尝试读取文件: ${path}`);

                if (fm.fileExists(path)) {
                    log(`文件存在: ${path}`);
                    const content = fm.readString(path);
                    const data = JSON.parse(content);

                    // 检查是否包含有效的账号信息
                    if (data?.username && data?.refreshToken) {
                        log(`找到有效账号信息: ${data.username}`);
                        return {
                            type: type.charAt(0).toUpperCase() + type.slice(1),
                            data: data
                        };
                    } else {
                        log(`文件存在但账号信息无效`);
                    }
                } else {
                    log(`文件不存在: ${path}`);
                }
            } catch (error) {
                log(`读取${type}版本账号信息失败: ${error.message}`);
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

// 显示设置
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
        super();  // 必须先调用 super()
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
        this.autoUpdateType = data?.autoUpdateType || 'stable'; // stable, alpha, beta
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

// 数据缓存
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
        super();  // 必须先调用 super()
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

// API 配置
const API_CONFIG = {
    baseUrls: {
        IFAS: "https://ifas.prod-chn.jlrmotor.com/ifas/jlr",
        IFOP: "https://ifop.prod-chn.jlrmotor.com/ifop/jlr",
        IFOA: "https://ifoa.prod-chn.jlrmotor.com"
    },
    extendUrl: "https://landrover.xiaojilinggui.com"
};

// 工具类
class Utils {
    static async wait(seconds) {
        log(`开始等待 ${seconds} 秒...`);
        const startTime = Date.now();

        // 使用 while 循环实现等待
        while (Date.now() - startTime < seconds * 1000) {
            // 每100ms检查一次
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
        log(`等待完成, 实际等待了 ${actualWait.toFixed(1)} 秒`);
    }

    static async retry(operation, maxAttempts = 3) {
        let lastError;
        for (let attempt = 0; attempt < maxAttempts; attempt++) {
            try {
                return await operation();
            } catch (error) {
                lastError = error;
                if (attempt === maxAttempts - 1) {
                    throw new Error(`操作失败, 已重试 ${maxAttempts} 次: ${error.message}`);
                }
                const delay = 2 * Math.pow(2, attempt); // 2秒, 4秒, 8秒
                log(`第 ${attempt + 1} 次尝试失败, 等待 ${delay} 秒后重试`);
                await this.wait(delay);
                log(`开始第 ${attempt + 2} 次尝试`);
            }
        }
        throw lastError;
    }

    static async getBackgroundImage() {
        const fm = FileManager.local();
        const bgPath = fm.joinPath(fm.documentsDirectory(), VersionManager.getFileName('background').replace('.json', '.jpg'));
        const settings = await WidgetSettings.getInstance();
        const currentBlur = settings.backgroundBlur;
        let img = null;  // 声明在外部

        if (fm.fileExists(bgPath)) {
            img = fm.readImage(bgPath);

            // 读取模糊配置
            if (img && currentBlur > 0) {  // 确保 img 存在
                // 创建绘图上下文
                const drawContext = new DrawContext();
                drawContext.size = new Size(img.size.width, img.size.height);

                // 绘制原图
                drawContext.drawImageInRect(img, new Rect(0, 0, img.size.width, img.size.height));

                // 叠加半透明层来模拟模糊效果
                const alpha = currentBlur / 100 * 1; // 最大透明度1
                drawContext.setFillColor(new Color("#000000", alpha));
                drawContext.fillRect(new Rect(0, 0, img.size.width, img.size.height));

                // 返回处理后的图片
                return drawContext.getImage();
            }
        }
        return img;  // 如果没有图片或处理失败, 返回 null
    }

    static formatObject(obj, result = []) {
        if (!obj || typeof obj !== 'object') return result;

        const processValue = (value) => {
            if (value === null || value === undefined || value === '') return false;
            if (typeof value === 'object') {
                if ('capabilities' in value) return false;  // 过滤 capabilities
                return true;
            }
            return true;
        };

        Object.entries(obj).forEach(([key, value]) => {
            // 跳过无效值和 capabilities
            if (!processValue(value)) return;

            if (typeof value === 'object') {
                if (Array.isArray(value)) {
                    // 处理数组
                    value.forEach((item, index) => {
                        if (typeof item === 'object') {
                            // 处理 {key, value} 格式
                            if ('key' in item && 'value' in item) {
                                result.push(`${item.key}: ${item.value}`);
                            } else {
                                this.formatObject(item, result);  // 递归处理其他对象
                            }
                        } else if (processValue(item)) {
                            result.push(`${key}: ${item}`);
                        }
                    });
                } else {
                    // 处理 {key, value} 格式
                    if ('key' in value && 'value' in value) {
                        result.push(`${value.key}: ${value.value}`);
                    } else {
                        // 递归处理其他对象
                        this.formatObject(value, result);
                    }
                }
            } else {
                // 处理基本类型
                result.push(`${key}: ${value}`);
            }
            // 遍历result, 如果包含"authToken", 则截断
            result.forEach((item, index) => {
                if (item.includes("authToken")) {
                    result[index] = `${item.substring(0, 20)}... (已截断)`;
                }
            });
        });

        return result;
    }

    // 查找对象中所有的时间字段
    static findLatestTime(status) {
        let latestTime = status.lastUpdatedTime;
        // 检查 vehicleAlerts 数组中的时间
        if (status.vehicleAlerts && Array.isArray(status.vehicleAlerts)) {
            status.vehicleAlerts.forEach(alert => {
                if (alert.lastUpdatedTime) {
                    const alertTime = alert.lastUpdatedTime;
                    if (!latestTime || new Date(alertTime) > new Date(latestTime)) {
                        latestTime = alertTime;
                    }
                    // log(`alertTime: ${alertTime}`);
                    // log(`latestTime: ${latestTime}`);
                }
            });
        }
        return latestTime;
    }
}

// API 类
class JLRConnectAPI {
    // 检查 accessToken 是否过期
    static async _checkAndRefreshToken(useToken=true) {
        const account = await AccountInfo.getInstance();
        const now = Math.floor(Date.now() / 1000);
        // 如果 accessToken 未设置或已过期, 提前尝试刷新避免刷新失败过期
        if (account.refreshToken) {
            log(`accessToken 剩余有效期: ${Math.floor(account.tokenExpiry - 3600 * 23 - 60 * 50 - now)} 秒`);
            if (account.accessToken && account.authToken && now < account.tokenExpiry - 3600 * 23 - 60 * 50) {
                if (!account.userId) {
                    // 获取用户信息
                    await this._getUserInfo();
                    } else {
                        log("用户ID存在, 跳过获取用户信息");
                    }
            }
            // log("accessToken 有效期 10 分钟强制刷新");
            else {
                log("accessToken 已过期或未设置, 尝试刷新");
                try {
                    await this._forceRefreshToken();
                    log("accessToken 刷新成功");
                    // 注册客户端
                    await this._registerClient();
                    if (!account.userId) {
                        // 获取用户信息
                        await this._getUserInfo();
                    } else {
                        log("用户ID存在, 跳过获取用户信息");
                    }
                    log("accessToken 更新完成");
                } catch (error) {
                    log("accessToken 刷新失败, 需要重新登录");
                    throw new Error("认证已过期, 请重新登录");
                }
            }
        } else {
            log("refreshToken 未找到或已过期, 需要重新登录");
            throw new Error("未找到有效的认证信息, 请重新登录");
        }
    }

    static async _forceRefreshToken() {
        const account = await AccountInfo.getInstance();
        await this._authenticate({
            grant_type: "refresh_token",
            refresh_token: account.refreshToken
        });
    }

    /**
     * 仅使用用户名密码登录
     */
    static async connect(username, password) {
        // 检查 email 和 password 是否为空
        if (!username || !password) {
            log("用户名和密码为空, 请先设置用户名和密码");
            return;
        }
        log("开始连接...");
        log("使用密码登录");
        try {
            await this._authenticate({
                grant_type: "password",
                username: username,
                password: password
            });
        } catch (error) {
            log("密码登录失败, 需要重新登录");
            throw new Error("密码登录失败, 请重新登录");
        }
        // 注册客户端
        await this._registerClient();
        // 获取用户信息
        await this._getUserInfo();
    }

    /**
     * 优先使用已保存的token登录, 失败则使用账号密码
     */
    static async connectByAccountOrToken() {
        // 如果已有有效的 accessToken 信息,直接使用
        const account = await AccountInfo.getInstance();
        log("尝试使用token登录");
        log(`accessToken: ${account.accessToken}`);
        log(`authToken: ${account.authToken?.substring(0, 20)}... (已截断)`);
        log(`refreshToken: ${account.refreshToken}`);
        if (account.accessToken && account.authToken && account.refreshToken) {
            log("accessToken存在");
            try {
                // 检查并刷新 accessToken
                await this._checkAndRefreshToken();
                log("使用现有accessToken成功");
            } catch (error) {
                log("使用现有accessToken失败, 需要重新登录");
                await this.connect(account.username, account.password);
            }
        } else {
            log("accessToken不存在, 使用密码登录");
            await this.connect(account.username, account.password);
        }
    }

    static async _authenticate(data) {
        return await Utils.retry(async () => {
            const url = `${API_CONFIG.baseUrls.IFAS}/tokens/tokensSSO`;
            log(`认证 URL: ${url}`);

            const request = new Request(url);
            request.method = "POST";
            request.headers = {
                "Host": "ifas.prod-chn.jlrmotor.com",
                "Authorization": "Basic YXM6YXNwYXNz",
                "Content-Type": "application/json",
                "user-agent": "jlrpy",
                "Accept": "*/*"
            };

            // 记录请求类型
            log(`认证类型: ${data.grant_type}`);
            if (data.grant_type === "password") {
                log(`使用账号: ${data.username}`);
            } else {
                log("使用 refreshToken");
            }

            request.body = JSON.stringify(data);
            request.timeoutInterval = 5;

            const response = await request.loadString();
            const statusCode = request.response.statusCode;  // 从 request.response 获取状态码
            if (statusCode === 200) {
                log(`认证成功, 状态码: ${statusCode}`);
            } else {
                log(`认证失败, 状态码: ${statusCode}`);
            }

            if (!response || response.trim().length === 0) {
                // 这种情况是用户名密码错误
                log("用户名或密码错误");
                throw new Error('用户名或密码错误');
            }


            const jsonResponse = JSON.parse(response);
            log("认证成功");
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
            log(`authToken: ${account.authToken?.substring(0, 20)}... (已截断)`);
            log(`tokenExpiry: ${account.tokenExpiry}`);
            await account.save();

            return jsonResponse;
        });
    }

    static async _registerClient() {
        return await Utils.retry(async () => {
            const account = await AccountInfo.getInstance();
            const url = `${API_CONFIG.baseUrls.IFOP}/users/${account.username}/clients`;
            log(`注册客户端 URL: ${url}`);
            await account.save();
            const request = new Request(url);
            request.method = "POST";
            request.headers = {
                "Host": "ifop.prod-chn.jlrmotor.com",
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
            // log(`data: ${JSON.stringify(data)}`);
            log(`deviceID: ${account.deviceId}`);
            request.body = JSON.stringify(data);
            request.timeoutInterval = 5;

            await request.loadString();  // 执行请求
            const statusCode = request.response.statusCode;  // 从 request.response 获取状态码
            if (statusCode === 204) {
                log(`客户端注册状态码: ${statusCode}`);
            } else {
                log(`客户端注册异常, 状态码: ${statusCode}`);
                // throw new Error(`客户端注册异常, 状态码: ${statusCode}`);
            }
        });
    }

    static async _getUserInfo() {
        return await Utils.retry(async () => {
            const account = await AccountInfo.getInstance();
            const url = `${API_CONFIG.baseUrls.IFOA}/if9/jlr/users?loginName=${account.username}`;
            log(`获取用户信息 URL: ${url}`);

            const request = new Request(url);
            request.method = "GET";
            request.timeoutInterval = 5; // 设置30秒超时
            request.headers = {
                "Host": "ifoa.prod-chn.jlrmotor.com",
                "Authorization": `Bearer ${account.accessToken}`,
                "Accept": "application/vnd.wirelesscar.ngtp.if9.User-v3+json",
                "Content-Type": "application/json",
                "X-Device-Id": account.deviceId,
                "x-telematicsprogramtype": "jlrpy",
                "x-App-Id": "ICR_JAGUAR_ANDROID",
                "x-App-Secret": "7bf6f544-1926-4714-8066-ceceb40d538d"
            };

            const response = await request.loadString();
            // log(`用户信息响应: ${response}`);
            const statusCode = request.response.statusCode;  // 从 request.response 获取状态码
            if (statusCode === 200) {
                const data = JSON.parse(response);
                if (!data.userId) {
                    throw new Error('获取用户ID失败');
                }
                account.userId = data.userId;
                log(`获取到用户ID: ${account.userId}`);
                log(`获取用户信息状态码: ${statusCode}`);
                await account.save();
                return data;
            } else {
                log(`获取用户信息异常, 状态码: ${statusCode}`);
                if (statusCode === 401) {
                    log("accessToken 已过期, 需要重新登录");
                    await this._forceRefreshToken();
                    await this._registerClient();
                    throw new Error("accessToken 已过期, 需要重新登录");
                }
            }
        });
    }

    static async getVehicleList() {
        const account = await AccountInfo.getInstance();
        if (!account.userId) {
            log("未找到用户ID, 无法获取车辆列表");
            return null;
        }
        return await Utils.retry(async () => {
            const url = `${API_CONFIG.baseUrls.IFOA}/if9/jlr/users/${account.userId}/vehicles?primaryOnly=true`;
            log(`获取车辆列表 URL: ${url}`);

            const request = new Request(url);
            request.method = "GET";
            request.headers = {
                "Host": "ifoa.prod-chn.jlrmotor.com",
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
            // log(`车辆列表响应: ${response}`);
            const statusCode = request.response.statusCode;  // 从 request.response 获取状态码
            if (statusCode === 200) {
                const data = JSON.parse(response);
                log(`获取车辆列表状态码: ${statusCode}`);
                return data.vehicles;
            } else {
                log(`获取车辆列表异常, 状态码: ${statusCode}`);
            }
        });
    }

    static async getVehicleAttributes(vin=null) {
        const account = await AccountInfo.getInstance();
        if (!vin && !account.vehicleId) {
            log("未找到车辆ID, 无法获取车辆属性");
            return null;
        }
        return await Utils.retry(async () => {
            const url = `${API_CONFIG.baseUrls.IFOA}/if9/jlr/vehicles/${vin || account.vehicleId}/attributes`;
            log(`获取车辆属性 URL: ${url}`);

            const request = new Request(url);
            request.method = "GET";
            request.headers = {
                "Host": "ifoa.prod-chn.jlrmotor.com",
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
                log(`获取车辆属性状态码: ${statusCode}`);

                if (statusCode === 200) {
                    const data = JSON.parse(response);
                    // 剔除掉capabilities字段
                    delete data.capabilities;
                    // 返回处理后的数据
                    return data;
                } else {
                    log(`获取车辆属性异常, 状态码: ${statusCode}`);
                    throw new Error(`获取车辆属性失败, 状态码: ${statusCode}`);
                }
            } catch (error) {
                log(`获取车辆属性出错: ${error.message}`);
                throw error; // 抛出错误以触发重试机制
            }
        });
    }

    static async getVehicleStatus(vin=null) {
        const account = await AccountInfo.getInstance();
        if (!vin && !account.vehicleId) {
            log("未找到车辆ID, 无法获取车辆状态");
            return null;
        }
        return await Utils.retry(async () => {
            const url = `${API_CONFIG.baseUrls.IFOA}/if9/jlr/vehicles/${vin || account.vehicleId}/status?includeInactive=true`;
            log(`获取车辆状态 URL: ${url}`);

            const request = new Request(url);
            request.method = "GET";
            request.headers = {
                "Host": "ifoa.prod-chn.jlrmotor.com",
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
            const statusCode = request.response.statusCode;  // 从 request.response 获取状态码
            if (statusCode === 200) {
                log(`获取车辆状态状态码: ${statusCode}`);
                return JSON.parse(response);
            } else {
                log(`获取车辆状态异常, 状态码: ${statusCode}`);
            }
        });
    }

    static async getVehiclePosition(vin=null) {
        const account = await AccountInfo.getInstance();
        if (!vin && !account.vehicleId) {
            log("未找到车辆ID, 无法获取车辆位置");
            return null;
        }
        return await Utils.retry(async () => {
            const url = `${API_CONFIG.baseUrls.IFOA}/if9/jlr/vehicles/${vin || account.vehicleId}/position`;
            log(`获取车辆位置 URL: ${url}`);

            const request = new Request(url);
            request.method = "GET";
            request.headers = {
                "Host": "ifoa.prod-chn.jlrmotor.com",
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
            const statusCode = request.response.statusCode;  // 从 request.response 获取状态码
            if (statusCode === 200) {
                log(`获取车辆位置状态码: ${statusCode}`);
                return JSON.parse(response);
            } else {
                log(`获取车辆位置异常, 状态码: ${statusCode}`);
            }
        });
    }
}

// 菜单管理类
class MenuManager {
    static async showMainMenu() {
        // 获取并显示当前更新周期
        const account = await AccountInfo.getInstance();
        let intervalText = "5分钟";  // 默认值

        // 转换更新周期显示
        if (account.updateInterval === 300) {
            intervalText = "5分钟";
        } else if (account.updateInterval === 600) {
            intervalText = "10分钟";
        } else if (account.updateInterval === 1800) {
            intervalText = "30分钟";
        } else if (account.updateInterval === 3600) {
            intervalText = "1小时";
        } else if (account.updateInterval === 7200) {
            intervalText = "2小时";
        } else if (account.updateInterval === 10800) {
            intervalText = "3小时";
        } else if (account.updateInterval === 21600) {
            intervalText = "6小时";
        } else if (account.updateInterval < 300) {
            intervalText = `${account.updateInterval}秒`;
        }

        const actions = [
            {
                title: "账户设置",
                action: () => this.showAccountSettings()
            },
            {
                title: "数据管理",
                action: () => this.showDataManager()
            },
            {
                title: "组件设置",
                action: () => this.showWidgetSettings()
            },
            {
                title: "检查更新",
                action: () => this.checkUpdate()
            },
            {
                title: "关于版权",
                action: () => this.showCopyright()
            }
        ];

        // 创建 ActionSheet
        const actionSheet = new Alert();
        actionSheet.title = "路虎助手";
        actionSheet.message = `当前更新周期: ${intervalText}`;

        // 添加所有操作
        actions.forEach(action => {
            actionSheet.addAction(action.title);
        });

        // 添加取消按钮
        actionSheet.addCancelAction("取消");

        // 显示 ActionSheet 并处理选择
        const response = await actionSheet.presentSheet();
        if (response !== -1) {
            await actions[response].action();
        }
    }

    static async showAccountSettings() {
        const account = await AccountInfo.getInstance();
        const alert = new Alert();
        alert.title = "账户设置";

        if (account.username && account.password && account.userId) {
            alert.message = `当前账号: ${account.username}`
            alert.addAction("选择车辆");
            alert.addAction("退出登录");
        } else {
            alert.message = "未登录, 请先登录";
            alert.addAction("登录账号");
        }
        alert.addAction("找回密码");  // 新增找回密码选项
        alert.addCancelAction("返回");

        const idx = await alert.presentSheet();
        if (idx === -1) {  // 用户点击了"返回"
            await this.showMainMenu();
            return;
        }
        if (account.username && account.password && account.userId) {
            switch (idx) {
                case 0:  // 选择车辆
                    await this.showVehicleSelect();
                    await this.updateData();
                    break;
                case 1:  // 退出登录
                    await this.logout();
                    break;
                case 2:  // 找回密码
                    await this.resetPassword();
                    break;
            }
        } else {
            switch (idx) {
                case 0:  // 登录账号
                    await this.showLoginSheet();
                    break;
                case 1:  // 找回密码
                    await this.resetPassword();
                    break;
            }
        }

        // 操作完成后返回账户设置菜单
        await this.showAccountSettings();
    }

    static async selectVehicle() {
        try {
            const vehicles = await JLRConnectAPI.getVehicleList();

            if (!vehicles || vehicles.length === 0) {
                await this.showNotification("错误", "未找到车辆");
                return;
            }

            const alert = new Alert();
            alert.title = "选择车辆";
            alert.message = "请选择要控制的车辆";

            for (const vehicle of vehicles) {
                const attributes = await JLRConnectAPI.getVehicleAttributes(vehicle.vin);
                alert.addAction(`${attributes.nickname} ${attributes.registrationNumber} ${attributes.vehicleType} \n VIN: ${vehicle.vin}`);
            }
            alert.addCancelAction("取消");

            const idx = await alert.present();
            if (idx !== -1) {
                const selectedVehicle = vehicles[idx];
                const account = await AccountInfo.getInstance();
                account.vehicleId = selectedVehicle.vin;
                await account.save();
                return selectedVehicle;
            }
        } catch (error) {
            this.showNotification("错误", `选择车辆失败: ${error.message}`);
        }
        return null;
    }

    static async logout() {
        // 清除账户信息
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
        await this.showNotification("已退出", "账号已退出登录");
    }

    static async resetPassword() {
        const resetUrl = "https://incontrol.landrover.com.cn/jlr-portal-owner-web/password-assistance/request-email";

        try {
            await Safari.open(resetUrl);
        } catch (error) {
            // 如果Safari打开失败，尝试使用系统默认浏览器
            await WebView.loadURL(resetUrl);
        }

        await this.showNotification("提示", "已打开密码重置页面，请在浏览器中完成操作");
    }

    static async showLoginSheet() {
        const alert = new Alert();
        alert.title = "登录账号";
        alert.message = "请填写登录信息";

        const account = await AccountInfo.getInstance();
        alert.addTextField("邮箱", account.username || "");
        alert.addSecureTextField("密码", account.password || "");

        alert.addAction("保存");
        alert.addCancelAction("取消");

        const idx = await alert.present();
        if (idx === 0) {
            try {
                await JLRConnectAPI.connect(alert.textFieldValue(0), alert.textFieldValue(1));
                await this.showVehicleSelect();
                await this.updateData();
            } catch (error) {
                await this.showNotification("错误", error.message);
            }
        }
    }

    static async showVehicleSelect() {
        try {
            const vehicles = await JLRConnectAPI.getVehicleList();

            if (!vehicles || vehicles.length === 0) {
                await this.showNotification("错误", "未找到车辆");
                return;
            }

            const alert = new Alert();
            alert.title = "选择车辆";
            alert.message = "请选择要控制的车辆";

            for (const vehicle of vehicles) {
                const attributes = await JLRConnectAPI.getVehicleAttributes(vehicle.vin);
                alert.addAction(`${attributes.nickname} ${attributes.registrationNumber} ${attributes.vehicleType} \n VIN: ${vehicle.vin}`);
            }
            alert.addCancelAction("取消");

            const idx = await alert.present();
            if (idx !== -1) {
                const selectedVehicle = vehicles[idx];
                const account = await AccountInfo.getInstance();
                account.vehicleId = selectedVehicle.vin;
                await account.save();
                return selectedVehicle;
            }
        } catch (error) {
            this.showNotification("错误", `选择车辆失败: ${error.message}`);
        }
        return null;
    }

    static async showUpdateIntervalSelect() {
        const alert = new Alert();
        alert.title = "更新周期";
        alert.message = "请选择数据更新周期";

        const intervals = [
            { name: "5分钟", value: 300 },
            { name: "10分钟", value: 600 },
            { name: "30分钟", value: 1800 },
            { name: "1小时", value: 3600 },
            { name: "2小时", value: 7200 },
            { name: "3小时", value: 10800 },
            { name: "6小时", value: 21600 },
        ];

        // 添加预设选项
        intervals.forEach(interval => {
            alert.addAction(interval.name);
        });

        // 添加自定义输入选项
        alert.addAction("自定义秒数");
        alert.addCancelAction("取消");

        const idx = await alert.present();

        let updateInterval;

        if (idx !== -1) {
            if (idx < intervals.length) {
                // 用户选择了预设选项
                updateInterval = intervals[idx].value;
            } else {
                // 用户选择了自定义输入
                const inputAlert = new Alert();
                inputAlert.title = "自定义更新周期";
                inputAlert.message = "请输入更新周期（30-3600秒）";
                inputAlert.addTextField("秒数", "300");
                inputAlert.addAction("确定");
                inputAlert.addCancelAction("取消");

                const inputResult = await inputAlert.present();

                if (inputResult === 0) {
                    const inputValue = parseInt(inputAlert.textFieldValue(0));

                    // 验证输入值
                    if (isNaN(inputValue) || inputValue < 30 || inputValue > 3600) {
                        this.showNotification("输入错误", "请输入30-3600之间的秒数");
                        return;
                    }

                    updateInterval = inputValue;
                } else {
                    return;
                }
            }

            // 保存配置
            const settings = await WidgetSettings.getInstance();
            settings.updateInterval = updateInterval;
            await settings.save();

            // 显示成功消息
            this.showNotification("已更新", `更新周期已设置为${updateInterval}秒`);
        }
    }

    static async updateData() {
        try {
            const vehicleData = await vehicleCache.getInstance();

            // 获取车辆详细信息
            const attributes = await JLRConnectAPI.getVehicleAttributes();
            const status = await JLRConnectAPI.getVehicleStatus();
            const position = await JLRConnectAPI.getVehiclePosition();

            // 判断请求成功才更新缓存
            if (attributes && status && position) {
                // 保存到缓存
                vehicleData.attributes = attributes;
                vehicleData.status = status;
                vehicleData.position = position;
                vehicleData.lastUpdate = new Date().toLocaleString('zh-CN');
                vehicleData.timestamp = Date.now();
                await vehicleData.save();
                // 重新渲染小组件
                await this.renderWidget();
                await this.showNotification("更新成功", `已更新车辆信息:\n${attributes.vehicleBrand} ${attributes.nickname || attributes.vehicleType}\n更新时间: ${new Date().toLocaleString('zh-CN')}`);
            } else {
                log(`更新失败: 请求失败`);
                this.showNotification("错误", `更新失败: 请求失败`);
            }
        } catch (error) {
            log(`更新失败: ${error.message}`);
            this.showNotification("错误", `更新失败: ${error.message}`);
        }
    }

    static async previewWidget() {
        try {
            const alert = new Alert();
            alert.title = "选择预览尺寸";
            alert.message = "请选择要预览的小组件尺寸";

            // 添加所有支持的尺寸选项
            alert.addAction("圆形锁屏组件");
            alert.addAction("行内锁屏组件");
            alert.addAction("矩形锁屏组件");
            alert.addAction("小尺寸");
            alert.addAction("中尺寸");
            alert.addAction("大尺寸");
            alert.addAction("超大尺寸");
            alert.addCancelAction("取消");

            const idx = await alert.present();

            // 根据选择创建并预览对应尺寸的小组件
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

                // 根据选择的尺寸调用对应的预览方法
                switch (idx) {
                    case 0:
                        await widget.presentAccessoryCircular();
                        break;
                    case 1:
                        await widget.presentAccessoryInline();
                        break;
                    case 2:
                        await widget.presentAccessoryRectangular();
                        break;
                    case 3:
                        await widget.presentSmall();
                        break;
                    case 4:
                        await widget.presentMedium();
                        break;
                    case 5:
                        await widget.presentLarge();
                        break;
                    case 6:
                        // 超大尺寸暂不支持
                        this.showNotification("暂不支持", "超大尺寸组件暂不支持预览");
                        break;
                }
            }
        } catch (error) {
            this.showNotification("错误", `预览失败: ${error.message}`);
        }
    }

    static async showDataManager() {
        const alert = new Alert();
        alert.title = "数据管理";
        alert.message = "请选择要执行的操作";

        alert.addAction("更新周期");
        alert.addAction("更新数据");
        alert.addAction("清除缓存");
        alert.addAction("缓存数据[仅限调试]");
        alert.addAction("账户数据[仅限调试]");
        alert.addAction("设置数据[仅限调试]");
        alert.addCancelAction("返回");

        const idx = await alert.presentSheet();
        if (idx === -1) {  // 用户点击了"返回"
            await this.showMainMenu();
            return;
        }

        switch (idx) {
            case 0:  // 更新周期
                await this.showUpdateIntervalSelect();
                break;
            case 1:  // 更新数据
                await this.updateData();
                break;
            case 2:  // 清除缓存
                await this.clearCache();
                break;
            case 3:  // 查看缓存
                await this.viewCache();
                break;
            case 4:  // 查看账户
                await this.viewAccount();
                break;
            case 5:  // 查看设置
                await this.viewSettings();
                break;
        }

        // 操作完成后返回数据管理菜单
        await this.showDataManager();
    }

    static async clearCache() {
        try {
            const fm = FileManager.local();
            const cachePath = fm.joinPath(
                fm.documentsDirectory(),
                VersionManager.getFileName('cache')
            );
            const accountPath = fm.joinPath(
                fm.documentsDirectory(),
                VersionManager.getFileName('account')
            );

            // 收集存在的文件信息
            const existingFiles = [];
            if (fm.fileExists(cachePath)) {
                existingFiles.push(`缓存文件: ${VersionManager.getFileName('cache')}`);
            }
            if (fm.fileExists(accountPath)) {
                existingFiles.push(`账号文件: ${VersionManager.getFileName('account')}`);
            }

            if (existingFiles.length === 0) {
                await this.showNotification("提示", "没有发现缓存文件");
                return;
            }

            const alert = new Alert();
            alert.title = "清除缓存";
            alert.message = "发现以下文件:\n" + existingFiles.join('\n') + "\n\n确定要清除这些文件吗？";
            alert.addAction("确定");
            alert.addCancelAction("取消");

            const userChoice = await alert.presentAlert();
            if (userChoice === 0) {
                if (fm.fileExists(cachePath)) {
                    fm.remove(cachePath);
                }
                if (fm.fileExists(accountPath)) {
                    fm.remove(accountPath);
                }
                // 重新渲染小组件
                const widget = await createWidget(false);  // 使用 false 强制获取新数据
                Script.setWidget(widget);
                await this.showNotification("清除成功", `已清除以下文件:\n${existingFiles.join('\n')}`);
            }
        } catch (error) {
            await this.showNotification("错误", `清除缓存失败: ${error.message}`);
        }
    }

    static async viewCache() {
        try {
            const cacheData = await vehicleCache.getInstance();
            const formattedLines = Utils.formatObject(cacheData);
            await this.showNotification("缓存内容", formattedLines.length > 0
                ? formattedLines.join('\n')
                : "无有效数据");
        } catch (error) {
            console.error("查看缓存失败:", error);
            await this.showNotification("错误", `读取缓存失败: ${error.message}`);
        }
    }

    static async viewAccount() {
        try {
            const account = await AccountInfo.getInstance();
            const formattedLines = Utils.formatObject(account);
            await this.showNotification("账户内容", formattedLines.length > 0
                ? formattedLines.join('\n')
                : "无有效数据");
        } catch (error) {
            console.error("查看账户失败:", error);
            await this.showNotification("错误", `读取账户失败: ${error.message}`);
        }
    }

    static async viewSettings() {
        try {
            const settings = await WidgetSettings.getInstance();
            const formattedLines = Utils.formatObject(settings);
            await this.showNotification("设置内容", formattedLines.length > 0
                ? formattedLines.join('\n')
                : "无有效数据");
        } catch (error) {
            console.error("查看设置失败:", error);
            await this.showNotification("错误", `读取设置失败: ${error.message}`);
        }
    }

    // 辅助方法: 显示通知
    static async showNotification(title, message) {
        const alert = new Alert();
        alert.title = title;
        alert.message = message;
        alert.addAction("确定");
        await alert.presentAlert();
    }

    // 新增组件设置菜单
    static async showWidgetSettings() {
        const alert = new Alert();
        alert.title = "组件设置";
        alert.message = "请选择要执行的操作";

        alert.addAction("手动预览");
        alert.addAction("手动渲染");
        alert.addAction("背景设置");
        alert.addCancelAction("返回");

        const idx = await alert.presentSheet();
        if (idx === -1) {  // 用户点击了"返回"
            await this.showMainMenu();
            return;
        }

        switch (idx) {
            case 0:  // 预览组件
                await this.previewWidget();
                break;
            case 1:  // 重新渲染
                await this.renderWidget(true, null, true);
                break;
            case 2:  // 背景设置
                await this.setBackgroundImage();
                break;
        }

        // 操作完成后返回组件设置菜单
        await this.showWidgetSettings();
    }

    static async renderWidget(useCache = true, family = null, showNotification = false, noErrorInterrupt = false) {
        try {
            // 重新渲染所有已添加的小组件
            const widget = await createWidget(useCache = useCache, family = family);
            if (noErrorInterrupt && !widget) {
                // 无报错打断且widget为null时，跳过渲染
                return;
            }
            // 其他情况都渲染
            Script.setWidget(widget);
            if (showNotification && !config.runsInWidget) {
                await this.showNotification("渲染成功", "小组件已重新渲染");
            }
        } catch (error) {
            if (!config.runsInWidget) {
                this.showNotification("错误", `渲染失败: ${error.message}`);
            }
        }
    }

    static async setBackgroundBlur() {
        const alert = new Alert();
        alert.title = "设置背景暗度";
        alert.message = "请选择预设值或输入自定义数值(0-100)";

        alert.addAction("浅色 (25%)");
        alert.addAction("中等 (50%)");
        alert.addAction("深色 (75%)");
        alert.addAction("自定义数值");
        alert.addCancelAction("取消");

        const choice = await alert.present();

        if (choice === 3) {
            // 用户选择自定义数值, 显示输入框
            return await this.setCustomBlur();
        } else if (choice !== -1) {
            // 使用预设值
            const presetValues = [25, 50, 75];
            const blurValue = presetValues[choice];

            // 保存暗度配置
            const settings = await WidgetSettings.getInstance();
            settings.backgroundBlur = blurValue;
            await settings.save();

            // 重新渲染小组件
            await this.renderWidget();
            await this.showNotification("设置成功", `背景暗度已设置为${blurValue}`);
        }
    }

    // 自定义数值输入
    static async setCustomBlur() {
        const alert = new Alert();
        alert.title = "自定义暗度";
        alert.message = "请输入背景暗度(0-100)\n0表示原图显示, 100表示最暗";

        // 读取当前暗度
        const settings = await WidgetSettings.getInstance();
        let currentBlur = settings.backgroundBlur;

        alert.addTextField("暗度", currentBlur.toString());
        alert.addAction("确定");
        alert.addCancelAction("取消");

        const idx = await alert.present();

        if (idx === 0) {
            const blurValue = parseInt(alert.textFieldValue(0));

            // 验证输入值
            if (isNaN(blurValue) || blurValue < 0 || blurValue > 100) {
                await this.showNotification("输入错误", "请输入0-100之间的数值");
                return;
            }

            // 保存暗度配置
            const settings = await WidgetSettings.getInstance();
            settings.backgroundBlur = blurValue;
            await settings.save();

            // 重新渲染小组件
            await this.renderWidget();
            await this.showNotification("设置成功", `背景暗度已设置为${blurValue}`);
        }
    }

    static async setBackgroundImage() {
        try {
            const imgPicker = new Alert();
            imgPicker.title = "设置背景图片";
            imgPicker.message = "请选择操作";

            imgPicker.addAction("从相册选择");
            imgPicker.addAction("从iCloud选择");
            imgPicker.addAction("设置暗度");
            imgPicker.addAction("恢复默认背景");
            imgPicker.addCancelAction("取消");

            const choice = await imgPicker.present();
            const fm = FileManager.local();
            // 修改: 使用版本化的文件名
            const bgPath = fm.joinPath(fm.documentsDirectory(), VersionManager.getFileName('background').replace('.json', '.jpg'));

            if (choice === 0) {
                // 从相册选择图片
                const img = await Photos.fromLibrary();
                fm.writeImage(bgPath, img);
                await this.setBackgroundBlur();
                // 重新渲染小组件
                await this.renderWidget();
            } else if (choice === 1) {
                // 从iCloud选择图片
                const iCloud = FileManager.iCloud();
                const baseDir = iCloud.documentsDirectory();
                // 列出iCloud中的图片文件
                const files = iCloud.listContents(baseDir).filter(file =>
                    file.toLowerCase().endsWith('.jpg') ||
                    file.toLowerCase().endsWith('.jpeg') ||
                    file.toLowerCase().endsWith('.png')
                );
                if (files.length === 0) {
                    await this.showNotification("未找到图片", "请先将图片文件放到iCloud Drive的Scriptable文件夹中");
                    return;
                }

                // 创建图片选择菜单
                const fileAlert = new Alert();
                fileAlert.title = "选择图片";
                fileAlert.message = "请选择要使用的图片文件";

                files.forEach(file => {
                    fileAlert.addAction(file);
                });
                fileAlert.addCancelAction("取消");

                const fileIdx = await fileAlert.present();

                if (fileIdx !== -1) {
                    const selectedFile = files[fileIdx];
                    const filePath = iCloud.joinPath(baseDir, selectedFile);

                    // 读取并保存图片
                    if (iCloud.fileExists(filePath)) {
                        const imageData = iCloud.readImage(filePath);
                        if (imageData) {
                            fm.writeImage(bgPath, imageData);
                            await this.setBackgroundBlur();
                        } else {
                            throw new Error("无法读取所选图片");
                        }
                    }
                }

            } else if (choice === 2) {
                // 设置已有图片的暗度
                if (!fm.fileExists(bgPath)) {
                    await this.showNotification("错误", "请先设置背景图片");
                    return;
                }
                await this.setBackgroundBlur();

            } else if (choice === 3) {
                // 删除自定义背景, 重置背景配置
                if (fm.fileExists(bgPath)) {
                    fm.remove(bgPath);
                }
                const settings = await WidgetSettings.getInstance();
                settings.backgroundBlur = 0;
                await settings.save();

                // 重新渲染小组件
                await this.renderWidget();
                await this.showNotification("已恢复默认", "已恢复默认背景");
            }
        } catch (error) {
            await this.showNotification("错误", `设置失败: ${error.message}`);
        }
    }

    static async checkUpdate() {
        try {
            const settings = await WidgetSettings.getInstance();
            const alert = new Alert();
            alert.title = "更新设置";
            alert.message = `自动更新: ${settings.autoUpdate ? '已开启' : '已关闭'}\n` +
                           `更新通道: ${settings.autoUpdateType === 'stable' ? '稳定版' : 
                                       settings.autoUpdateType === 'beta' ? 'Beta版' : 'Alpha版'}`;

            alert.addAction("检查更新");
            alert.addAction("自动更新设置");
            alert.addCancelAction("返回");

            const choice = await alert.presentSheet();

            if (choice === -1) {
                await this.showMainMenu();
                return;
            }

            switch (choice) {
                case 0: // 检查更新
                    await this.performUpdateCheck();
                    break;
                case 1: // 自动更新设置
                    await this.showAutoUpdateSettings();
                    break;
            }

            // 返回更新设置菜单
            await this.checkUpdate();
        } catch (error) {
            await this.showNotification("错误", `更新设置出错: ${error.message}`);
        }
    }

    static async performUpdateCheck() {
        try {
            // 让用户选择版本类型
            const versionAlert = new Alert();
            const {version: currentVersion, type: currentVersionType} = VersionManager.getVersionInfo();
            versionAlert.title = "选择版本";
            versionAlert.message = `当前版本: ${currentVersion} ${currentVersionType}\n\n` +
                "稳定版: 经过完整测试的正式版本\n" +
                "Alpha版: 包含最新功能, 但Bug很多\n" +
                "Beta版: 完成主要测试的公测版本\n\n" +
                "* Alpha和Beta版可能存在未知问题\n" +
                "如果遇到功能异常, 请切换到稳定版";

            versionAlert.addAction("稳定版");
            versionAlert.addAction("Alpha版");
            versionAlert.addAction("Beta版");
            versionAlert.addCancelAction("取消");

            const choice = await versionAlert.present();

            if (choice !== -1) {
                // 获取本地配置中的 refreshToken
                const account = await AccountInfo.getInstance();
                if (!account.refreshToken) {
                    throw new Error("未找到有效的认证信息, 请先登录");
                }

                // 根据选择设置不同的更新检查URL
                let updateUrl;
                let versionType;
                switch (choice) {
                    case 0:
                        updateUrl = `${API_CONFIG.extendUrl}/scriptable/update/stable`;
                        versionType = "稳定版";
                        break;
                    case 1:
                        updateUrl = `${API_CONFIG.extendUrl}/scriptable/update/alpha`;
                        versionType = "Alpha版";
                        break;
                    case 2:
                        updateUrl = `${API_CONFIG.extendUrl}/scriptable/update/beta`;
                        versionType = "Beta版";
                        break;
                }

                // 创建 POST 请求
                const request = new Request(updateUrl);
                request.method = "POST";
                request.headers = {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${account.refreshToken}`,
                    "Authorization-MAIL": `${account.username}`
                };
                request.timeoutInterval = 10;

                // 添加请求体
                request.body = JSON.stringify({
                    currentVersion: currentVersion,
                    currentVersionType: currentVersionType,
                    platform: Device.systemName(),
                    deviceModel: Device.model(),
                    systemVersion: Device.systemVersion(),
                });

                // 发送请求并获取响应
                const response = await request.loadString();
                // log(`更新检查响应: ${response}`);

                // 解析响应
                const updateInfo = JSON.parse(response);

                const alert = new Alert();

                if (updateInfo.hasUpdate) {
                    // 有更新时显示更新确认对话框
                    alert.title = "发现新版本";
                    alert.message = `当前版本: ${currentVersion} ${currentVersionType}\n` +
                        `最新版本: ${updateInfo.latestVersion} ${updateInfo.latestVersionType}\n\n` +
                        `更新内容:\n${updateInfo.changelog}`;
                    alert.addAction("立即更新");
                    alert.addCancelAction("取消");
                } else {
                    alert.title = "当前版本是最新版本";
                    alert.message = `当前版本: ${currentVersion} ${currentVersionType}`;
                    alert.addAction("重新下载");
                    alert.addCancelAction("取消");
                }

                const userChoice = await alert.present();

                if (userChoice === 0) {
                    // 直接使用返回的新版本代码
                    const newScript = updateInfo.scriptContent;
                    // 保存新版本脚本
                    const fm = FileManager.local();
                    const currentPath = module.filename;

                    // 先备份当前版本
                    const backupPath = currentPath + '.backup';
                    if (fm.fileExists(backupPath)) {
                        fm.remove(backupPath);
                    }
                    fm.copy(currentPath, backupPath);

                    // 写入新版本
                    fm.writeString(currentPath, newScript);

                    // 提示更新完成
                    this.showNotification("更新成功", `脚本已更新到最新${versionType}, 请重新运行脚本`);

                    // 退出脚本
                    Script.complete();
                }
            }
        } catch (error) {
            this.showNotification("错误", `检查更新失败: ${error.message}`);
        }
    }

    static async showAutoUpdateSettings() {
        const settings = await WidgetSettings.getInstance();
        const alert = new Alert();
        alert.title = "自动更新设置";
        alert.message = "设置自动更新选项";

        alert.addAction(settings.autoUpdate ? "关闭自动更新" : "开启自动更新");
        if (settings.autoUpdate) {
            alert.addAction("更新通道设置");
        }
        alert.addCancelAction("返回");

        const choice = await alert.presentSheet();

        if (choice === -1) {
            return;
        }

        if (choice === 0) {
            // 切换自动更新状态
            settings.autoUpdate = !settings.autoUpdate;
            await settings.save();
            await this.showNotification("设置已更新",
                `自动更新已${settings.autoUpdate ? '开启' : '关闭'}`);
        } else if (choice === 1 && settings.autoUpdate) {
            // 显示更新通道设置
            await this.showUpdateChannelSettings();
        }
    }

    static async showUpdateChannelSettings() {
        const settings = await WidgetSettings.getInstance();
        const alert = new Alert();
        alert.title = "更新通道设置";
        alert.message = "选择自动更新使用的更新通道\n\n" +
                       "稳定版: 经过完整测试的正式版本\n" +
                       "Beta版: 完成主要测试的公测版本\n" +
                       "Alpha版: 包含最新功能但可能不稳定";

        alert.addAction("稳定版");
        alert.addAction("Beta版");
        alert.addAction("Alpha版");
        alert.addCancelAction("返回");

        const choice = await alert.presentSheet();

        if (choice !== -1) {
            const channels = ['stable', 'beta', 'alpha'];
            settings.autoUpdateType = channels[choice];
            await settings.save();
            await this.showNotification("设置已更新",
                `更新通道已设置为${choice === 0 ? '稳定版' : 
                                   choice === 1 ? 'Beta版' : 'Alpha版'}`);
        }
    }

    // 添加显示版权声明的方法
    static async showCopyright() {
        await this.showNotification("版权声明",
            "本项目是一个由@xuyuanfang发起的开源项目, 遵循 GPL-3.0 开源许可证。\n\n" +
            "项目仓库地址: \nhttps://github.com/xuyuanfang/WidgetKitForCar\n\n" +
            "欢迎访问项目仓库获取最新版本, 提交问题反馈或参与贡献。\n" +
            "您可以自由使用、修改和分发本项目, 但衍生作品必须以相同方式开源。\n\n" +
            "声明: Land Rover、路虎以及其Logo均为捷豹路虎汽车有限公司的注册商标。\n" +
            "本项目为非官方工具, 与捷豹路虎汽车有限公司无关。");
    }
}

// 主函数
async function createWidget(useCache = false, family = null) {
    log("开始创建小组件");
    // 添加自动更新检查逻辑
    try {
        const settings = await WidgetSettings.getInstance();

        // 只在开启自动更新时执行检查
        if (settings.autoUpdate) {
            const fm = FileManager.local();
            const lastCheckPath = fm.joinPath(fm.documentsDirectory(),
                VersionManager.getFileName('lastUpdateCheck'));
            let lastCheckTime = 0;

            if (fm.fileExists(lastCheckPath)) {
                lastCheckTime = parseInt(fm.readString(lastCheckPath));
            }

            const now = Date.now();
            // 每24小时检查一次更新
            if (now - lastCheckTime > 24 * 60 * 60 * 1000) {
                log("执行自动更新检查...");

                const account = await AccountInfo.getInstance();
                if (account.refreshToken) {
                    const {version: currentVersion, type: currentVersionType} =
                        VersionManager.getVersionInfo();

                    // 根据设置选择更新通道
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
                        log("发现新版本，准备更新...");
                        // 保存新版本脚本
                        const currentPath = module.filename;

                        // 先备份当前版本
                        const backupPath = currentPath + '.backup';
                        if (fm.fileExists(backupPath)) {
                            fm.remove(backupPath);
                        }
                        fm.copy(currentPath, backupPath);

                        // 写入新版本
                        fm.writeString(currentPath, updateInfo.scriptContent);
                        log("更新完成，将在下次运行时生效");
                    }
                }

                // 更新检查时间
                fm.writeString(lastCheckPath, now.toString());
            }
        }
    } catch (error) {
        log(`自动更新检查失败: ${error.message}`);
    }

    log(`传入的小组件尺寸: ${family}`);
    log(`系统小组件尺寸: ${config.widgetFamily}`);

    const widget = new ListWidget();
    if (family === 'small' || family === 'medium' || family === 'large') {
        // 尝试使用自定义背景图片
        const bgImage = await Utils.getBackgroundImage();
        if (bgImage) {
            widget.backgroundImage = bgImage;
        } else {
            // widget.backgroundColor = new Color('#005A2B');  // 默认使用路虎绿色
            // 创建系统风格的渐变背景
            const gradient = new LinearGradient();

            // 设置渐变方向（从左上到右下）
            gradient.startPoint = new Point(0, 0);
            gradient.endPoint = new Point(1, 1);

            // 添加渐变色
            gradient.colors = [
                new Color("#1C1C1E"),
                new Color("#2C2C2E"),
                new Color("#3C3C3E")
            ];

            // 设置颜色位置
            gradient.locations = [0.0, 0.5, 1.0];

            widget.backgroundGradient = gradient;
        }
    }
    // 确定实际使用的尺寸
    const widgetFamily = family || config.widgetFamily || 'medium';
    log(`最终使用的小组件尺寸: ${widgetFamily}`);

    try {
        const account = await AccountInfo.getInstance();
        log("加载配置信息");

        // 确定小组件尺寸
        let widgetFamily = family || args.widgetFamily || 'medium';
        log(`使用小组件尺寸: ${widgetFamily}`);

        if (!account.username || !account.password) {
            log("未找到配置信息");
            const text = widget.addText("请先登录设置");
            text.textColor = Color.white();
            text.font = Font.mediumSystemFont(14);
            return widget;
        }

        // 获取数据
        let vehicleData = await vehicleCache.getInstance();
        // log(`缓存数据: ${JSON.stringify(vehicleData, null, 2)}`);
        // 如果需要刷新数据且不是强制使用缓存
        if (!useCache) {
            try {
                log("尝试获取新数据");
                const attributes = await JLRConnectAPI.getVehicleAttributes();
                const status = await JLRConnectAPI.getVehicleStatus();
                const position = await JLRConnectAPI.getVehiclePosition();

                vehicleData.attributes = attributes;
                vehicleData.status = status;
                vehicleData.position = position;
                vehicleData.lastUpdate = new Date().toLocaleString('zh-CN');
                vehicleData.timestamp = Date.now();
                // 更新缓存
                await vehicleData.save();
            } catch (error) {
                log("获取新数据失败, 将使用缓存或默认值");
                log(`错误信息: ${error.message}`);
            }
        }
        // log(`更新后数据: ${JSON.stringify(vehicleData, null, 2)}`);

        if (vehicleData && vehicleData.status && vehicleData.attributes && vehicleData.position) {
            const status = vehicleData.status;
            const attributes = vehicleData.attributes;
            const position = vehicleData.position;

            // 创建主布局栈
            const mainStack = widget.addStack();
            mainStack.layoutVertically();
            mainStack.spacing = widgetFamily === 'small' ? 4 : 6;

            // 根据尺寸显示不同内容

            if (widgetFamily === 'accessoryCircular') {
                // 圆形组件只显示油量和续航
                const fuelLevel = status.vehicleStatus.coreStatus.find(s => s.key === "FUEL_LEVEL_PERC").value;
                const fuelText = mainStack.addText(`${fuelLevel}%`);
                fuelText.textColor = new Color(fuelLevel > 20 ? '#34C759' : '#FF3B30');
                fuelText.font = Font.boldSystemFont(20);
                fuelText.centerAlignText();

                const distanceToEmpty = status.vehicleStatus.coreStatus.find(s => s.key === "DISTANCE_TO_EMPTY_FUEL").value;
                const rangeText = mainStack.addText(`续航${distanceToEmpty}km`);
                rangeText.textColor = Color.white();
                rangeText.font = Font.systemFont(10);
                rangeText.centerAlignText();
            }else if (widgetFamily === 'accessoryInline') {
                // 内联小组件只显示一行信息
                const fuelLevel = status.vehicleStatus.coreStatus.find(s => s.key === "FUEL_LEVEL_PERC").value;
                const distanceToEmpty = status.vehicleStatus.coreStatus.find(s => s.key === "DISTANCE_TO_EMPTY_FUEL").value;
                const title = mainStack.addText(`爱车油量${fuelLevel}% (${distanceToEmpty} km)`);
                title.textColor = Color.white();
                title.font = Font.boldSystemFont(13);
                title.lineLimit = 1;
            } else if (widgetFamily === 'accessoryRectangular') {
                // 方形组件布局改为左右两栈
                const contentStack = mainStack.addStack();
                contentStack.layoutHorizontally();
                contentStack.spacing = 4;

                // 左侧信息栈
                const leftStack = contentStack.addStack();
                leftStack.layoutVertically();
                leftStack.spacing = 2;

                // 油量显示（调大字号）
                const fuelLevel = status.vehicleStatus.coreStatus.find(s => s.key === "FUEL_LEVEL_PERC").value;
                const fuelText = leftStack.addText(`${fuelLevel}%`);
                fuelText.textColor = new Color(fuelLevel > 20 ? '#34C759' : '#FF3B30');
                fuelText.font = Font.boldSystemFont(26);  // 调大字号并加粗
                fuelText.lineLimit = 1;

                leftStack.addSpacer(1);  // 添加小间距

                // 续航里程
                const distanceToEmpty = status.vehicleStatus.coreStatus.find(s => s.key === "DISTANCE_TO_EMPTY_FUEL").value;
                const rangeText = leftStack.addText(`续航${distanceToEmpty}km`);
                rangeText.textColor = Color.white();
                rangeText.font = Font.systemFont(13);
                rangeText.lineLimit = 1;

                contentStack.addSpacer();

                // 右侧状态栈
                const rightStack = contentStack.addStack();
                rightStack.layoutVertically();
                rightStack.spacing = 3;  // 调整右侧间距使总高度与左侧一致

                const isLocked = status.vehicleStatus.coreStatus.find(s => s.key === "DOOR_IS_ALL_DOORS_LOCKED").value === "TRUE";
                const lockText = rightStack.addText(isLocked ? '已锁车' : '未锁车');
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

                const doorText = rightStack.addText(doorsStatus ? '已关门' : '未关门');
                doorText.textColor = doorsStatus ? new Color('#34C759') : new Color('#FF3B30');
                doorText.font = Font.systemFont(13);
                doorText.lineLimit = 1;

                const windowsStatus = Object.values({
                    frontLeft: status.vehicleStatus.coreStatus.find(s => s.key === "WINDOW_FRONT_LEFT_STATUS").value,
                    frontRight: status.vehicleStatus.coreStatus.find(s => s.key === "WINDOW_FRONT_RIGHT_STATUS").value,
                    rearLeft: status.vehicleStatus.coreStatus.find(s => s.key === "WINDOW_REAR_LEFT_STATUS").value,
                    rearRight: status.vehicleStatus.coreStatus.find(s => s.key === "WINDOW_REAR_RIGHT_STATUS").value
                }).every(v => v === "CLOSED");

                const windowText = rightStack.addText(windowsStatus ? '已关窗' : '未关窗');
                windowText.textColor = windowsStatus ? new Color('#34C759') : new Color('#FF3B30');
                windowText.font = Font.systemFont(13);
                windowText.lineLimit = 1;
            } else if (widgetFamily === 'small') {
                // 小尺寸只显示最重要信息
                const title = mainStack.addText(attributes.nickname || "爱车");
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
                const rangeText = mainStack.addText(`续航${distanceToEmpty}km`);
                rangeText.textColor = Color.white();
                rangeText.font = Font.systemFont(16);
                rangeText.centerAlignText();

            } else if (widgetFamily === 'medium') {
                // 中尺寸显示基本信息
                const headerStack = mainStack.addStack();
                headerStack.layoutHorizontally();

                const title = headerStack.addText(attributes.nickname || "爱车");
                title.textColor = Color.white();
                title.font = Font.boldSystemFont(20);
                title.lineLimit = 1;

                headerStack.addSpacer();

                const fuelLevel = status.vehicleStatus.coreStatus.find(s => s.key === "FUEL_LEVEL_PERC").value;
                const fuelText = headerStack.addText(`${fuelLevel}%`);
                fuelText.textColor = new Color(fuelLevel > 20 ? '#34C759' : '#FF3B30');
                fuelText.font = Font.mediumSystemFont(20);

                // 状态信息栈
                const statusStack = mainStack.addStack();
                statusStack.layoutHorizontally();
                statusStack.spacing = 8;

                // 左侧信息
                const leftStack = statusStack.addStack();
                leftStack.layoutVertically();
                leftStack.spacing = 2;

                const distanceToEmpty = status.vehicleStatus.coreStatus.find(s => s.key === "DISTANCE_TO_EMPTY_FUEL").value;
                const rangeText = leftStack.addText(`续航${distanceToEmpty}km`);
                rangeText.textColor = Color.white();
                rangeText.font = Font.systemFont(16);
                rangeText.lineLimit = 1;

                const odometerKm = Math.floor(status.vehicleStatus.coreStatus.find(s => s.key === "ODOMETER").value / 1000);
                const mileageText = leftStack.addText(`里程${odometerKm}km`);
                mileageText.textColor = Color.white();
                mileageText.font = Font.systemFont(16);
                mileageText.lineLimit = 1;

                statusStack.addSpacer();

                // 右侧状态
                const rightStack = statusStack.addStack();
                rightStack.layoutVertically();
                rightStack.spacing = 2;

                const isLocked = status.vehicleStatus.coreStatus.find(s => s.key === "DOOR_IS_ALL_DOORS_LOCKED").value === "TRUE";
                const lockText = rightStack.addText(isLocked ? '已锁车' : '未锁车');
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

                const doorText = rightStack.addText(doorsStatus ? '已关门' : '未关门');
                doorText.textColor = doorsStatus ? new Color('#34C759') : new Color('#FF3B30');
                doorText.font = Font.systemFont(14);
                doorText.lineLimit = 1;

                // 添加车窗状态
                const windowsStatus = Object.values({
                    frontLeft: status.vehicleStatus.coreStatus.find(s => s.key === "WINDOW_FRONT_LEFT_STATUS").value,
                    frontRight: status.vehicleStatus.coreStatus.find(s => s.key === "WINDOW_FRONT_RIGHT_STATUS").value,
                    rearLeft: status.vehicleStatus.coreStatus.find(s => s.key === "WINDOW_REAR_LEFT_STATUS").value,
                    rearRight: status.vehicleStatus.coreStatus.find(s => s.key === "WINDOW_REAR_RIGHT_STATUS").value
                }).every(v => v === "CLOSED");

                const windowText = rightStack.addText(windowsStatus ? '已关窗' : '未关窗');
                windowText.textColor = windowsStatus ? new Color('#34C759') : new Color('#FF3B30');
                windowText.font = Font.systemFont(14);
                windowText.lineLimit = 1;
            } else if (widgetFamily === 'large') {
                // 大尺寸显示所有信息
                const headerStack = mainStack.addStack();
                headerStack.layoutHorizontally();

                const title = headerStack.addText(attributes.nickname || "爱车");
                title.textColor = Color.white();
                title.font = Font.boldSystemFont(20);
                title.lineLimit = 1;

                headerStack.addSpacer();

                // 创建右侧油量和续航的垂直堆栈
                const fuelStack = headerStack.addStack();
                fuelStack.layoutVertically();
                fuelStack.spacing = 2;

                const fuelLevel = status.vehicleStatus.coreStatus.find(s => s.key === "FUEL_LEVEL_PERC").value;
                const fuelText = fuelStack.addText(`${fuelLevel}%`);
                fuelText.textColor = new Color(fuelLevel > 20 ? '#34C759' : '#FF3B30');
                fuelText.font = Font.mediumSystemFont(20);
                fuelText.rightAlignText();

                const distanceToEmpty = status.vehicleStatus.coreStatus.find(s => s.key === "DISTANCE_TO_EMPTY_FUEL").value;
                const rangeText = fuelStack.addText(`续航${distanceToEmpty}km`);
                rangeText.textColor = Color.white();
                rangeText.font = Font.systemFont(12);
                rangeText.rightAlignText();

                // mainStack.addSpacer(4);

                // 基本信息栈
                const basicStack = mainStack.addStack();
                basicStack.layoutVertically();
                basicStack.spacing = 4;

                const isLocked = status.vehicleStatus.coreStatus.find(s => s.key === "DOOR_IS_ALL_DOORS_LOCKED").value === "TRUE";
                const lockText = basicStack.addText(`车辆${isLocked ? '已锁车' : '未锁车'}`);
                lockText.textColor = isLocked ? new Color('#34C759') : new Color('#FF3B30');
                lockText.font = Font.systemFont(12);
                lockText.lineLimit = 1;

                const odometerKm = Math.floor(status.vehicleStatus.coreStatus.find(s => s.key === "ODOMETER").value / 1000);
                const serviceKm = status.vehicleStatus.coreStatus.find(s => s.key === "EXT_KILOMETERS_TO_SERVICE").value;
                const mileageText = basicStack.addText(`总里程${odometerKm}km    距保养${serviceKm}km`);
                mileageText.textColor = Color.white();
                mileageText.font = Font.systemFont(12);
                mileageText.lineLimit = 1;

                // 车辆状态栈
                const statusStack = mainStack.addStack();
                statusStack.layoutVertically();
                statusStack.spacing = 4;

                // 车门状态详情
                const doorStatus = {
                    frontLeft: status.vehicleStatus.coreStatus.find(s => s.key === "DOOR_FRONT_LEFT_POSITION").value,
                    frontRight: status.vehicleStatus.coreStatus.find(s => s.key === "DOOR_FRONT_RIGHT_POSITION").value,
                    rearLeft: status.vehicleStatus.coreStatus.find(s => s.key === "DOOR_REAR_LEFT_POSITION").value,
                    rearRight: status.vehicleStatus.coreStatus.find(s => s.key === "DOOR_REAR_RIGHT_POSITION").value,
                    hood: status.vehicleStatus.coreStatus.find(s => s.key === "DOOR_ENGINE_HOOD_POSITION").value,
                    boot: status.vehicleStatus.coreStatus.find(s => s.key === "DOOR_BOOT_POSITION").value
                };

                // 车门状态标题
                const doorTitle = statusStack.addText("车门状态");
                doorTitle.textColor = Color.white();
                doorTitle.font = Font.boldSystemFont(12);

                // 前排车门
                const frontDoorText = statusStack.addText(
                    `左前门: ${doorStatus.frontLeft === "CLOSED" ? "已关闭" : "未关闭"}    ` +
                    `右前门: ${doorStatus.frontRight === "CLOSED" ? "已关闭" : "未关闭"}`
                );
                frontDoorText.textColor = (doorStatus.frontLeft === "CLOSED" && doorStatus.frontRight === "CLOSED") ?
                    new Color('#34C759') : new Color('#FF3B30');
                frontDoorText.font = Font.systemFont(12);
                frontDoorText.lineLimit = 1;

                // 后排车门
                const rearDoorText = statusStack.addText(
                    `左后门: ${doorStatus.rearLeft === "CLOSED" ? "已关闭" : "未关闭"}    ` +
                    `右后门: ${doorStatus.rearRight === "CLOSED" ? "已关闭" : "未关闭"}`
                );
                rearDoorText.textColor = (doorStatus.rearLeft === "CLOSED" && doorStatus.rearRight === "CLOSED") ?
                    new Color('#34C759') : new Color('#FF3B30');
                rearDoorText.font = Font.systemFont(12);
                rearDoorText.lineLimit = 1;

                // 引擎盖和后备箱
                const otherDoorsText = statusStack.addText(
                    `引擎盖: ${doorStatus.hood === "CLOSED" ? "已关闭" : "未关闭"}    ` +
                    `后备箱: ${doorStatus.boot === "CLOSED" ? "已关闭" : "未关闭"}`
                );
                otherDoorsText.textColor = (doorStatus.hood === "CLOSED" && doorStatus.boot === "CLOSED") ?
                    new Color('#34C759') : new Color('#FF3B30');
                otherDoorsText.font = Font.systemFont(12);
                otherDoorsText.lineLimit = 1;

                // 添加一个小间距
                // statusStack.addSpacer(4);

                // 车窗状态
                const windowStatus = {
                    frontLeft: status.vehicleStatus.coreStatus.find(s => s.key === "WINDOW_FRONT_LEFT_STATUS").value,
                    frontRight: status.vehicleStatus.coreStatus.find(s => s.key === "WINDOW_FRONT_RIGHT_STATUS").value,
                    rearLeft: status.vehicleStatus.coreStatus.find(s => s.key === "WINDOW_REAR_LEFT_STATUS").value,
                    rearRight: status.vehicleStatus.coreStatus.find(s => s.key === "WINDOW_REAR_RIGHT_STATUS").value
                };

                // 车窗状态标题
                const windowTitle = statusStack.addText("车窗状态");
                windowTitle.textColor = Color.white();
                windowTitle.font = Font.boldSystemFont(12);

                // 前排车窗
                const frontWindowText = statusStack.addText(
                    `左前窗: ${windowStatus.frontLeft === "CLOSED" ? "已关闭" : "未关闭"}    ` +
                    `右前窗: ${windowStatus.frontRight === "CLOSED" ? "已关闭" : "未关闭"}`
                );
                frontWindowText.textColor = (windowStatus.frontLeft === "CLOSED" && windowStatus.frontRight === "CLOSED") ?
                    new Color('#34C759') : new Color('#FF3B30');
                frontWindowText.font = Font.systemFont(12);
                frontWindowText.lineLimit = 1;

                // 后排车窗
                const rearWindowText = statusStack.addText(
                    `左后窗: ${windowStatus.rearLeft === "CLOSED" ? "已关闭" : "未关闭"}    ` +
                    `右后窗: ${windowStatus.rearRight === "CLOSED" ? "已关闭" : "未关闭"}`
                );
                rearWindowText.textColor = (windowStatus.rearLeft === "CLOSED" && windowStatus.rearRight === "CLOSED") ?
                    new Color('#34C759') : new Color('#FF3B30');
                rearWindowText.font = Font.systemFont(12);
                rearWindowText.lineLimit = 1;

                // 添加一个小间距
                statusStack.addSpacer(4);

                // 胎压信息
                const tyrePressures = {
                    FL: status.vehicleStatus.coreStatus.find(s => s.key === "TYRE_PRESSURE_FRONT_LEFT").value,
                    FR: status.vehicleStatus.coreStatus.find(s => s.key === "TYRE_PRESSURE_FRONT_RIGHT").value,
                    RL: status.vehicleStatus.coreStatus.find(s => s.key === "TYRE_PRESSURE_REAR_LEFT").value,
                    RR: status.vehicleStatus.coreStatus.find(s => s.key === "TYRE_PRESSURE_REAR_RIGHT").value
                };

                // 胎压信息标题
                const tyreTitle = statusStack.addText("胎压状态");
                tyreTitle.textColor = Color.white();
                tyreTitle.font = Font.boldSystemFont(12);

                // 前轮胎压
                const frontTyreText = statusStack.addText(
                    `左前轮: ${tyrePressures.FL}kPa    ` +
                    `右前轮: ${tyrePressures.FR}kPa`
                );
                frontTyreText.textColor = Color.white();
                frontTyreText.font = Font.systemFont(12);
                frontTyreText.lineLimit = 1;

                // 后轮胎压
                const rearTyreText = statusStack.addText(
                    `左后轮: ${tyrePressures.RL}kPa    ` +
                    `右后轮: ${tyrePressures.RR}kPa`
                );
                rearTyreText.textColor = Color.white();
                rearTyreText.font = Font.systemFont(12);
                rearTyreText.lineLimit = 1;

                // 添加一个小间距
                // statusStack.addSpacer(4);
            } else if(widgetFamily === 'extraLarge'){
                const text = mainStack.addText("暂不支持该尺寸, 请使用其他尺寸");
                text.textColor = Color.orange();
                text.font = Font.mediumSystemFont(14);
            }
            if (widgetFamily === 'small' || widgetFamily === 'medium' || widgetFamily === 'large') {
                // 添加更新时间
                mainStack.addSpacer();

                // 获取服务器数据时间
                let serverTimeStr;
                try {
                    // 检查并获取正确的时间字段
                    const serverUpdateTime = Utils.findLatestTime(status);

                    log(`原始服务器时间: ${serverUpdateTime}`);
                    if (!serverUpdateTime) {
                        // 如果还是找不到, 记录完整的状态数据以便调试
                        log('完整状态数据:');
                        log(JSON.stringify(status, null, 2));
                        serverTimeStr = `获取失败(找不到时间字段)`;
                    } else {
                        // 直接从间字符串中提取需要的部分
                        // 格式: "2024-12-13T11:29:37+0000"
                        const matches = serverUpdateTime.match(/(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})\+/);
                        if (matches) {
                            const [_, year, month, day, hour, minute] = matches;
                            // 转换为北京时间 (UTC+8)
                            const localHour = (parseInt(hour) + 8) % 24;
                            serverTimeStr = `${month}-${day} ${localHour.toString().padStart(2, '0')}:${minute}`;
                            log(`解析后的时间: ${serverTimeStr}`);
                        } else {
                            serverTimeStr = `格式错误(${serverUpdateTime})`;
                            log('时间格式不匹配');
                        }
                    }
                } catch (error) {
                    log(`解析服务器时间出错: ${error.message}`);
                    log(`状态数据: ${JSON.stringify(status, null, 2)}`);
                    serverTimeStr = `解析失败(${error.message})`;
                }
                // 显示服务器更新时间的部分, 添加一个带半透明背景的 stack
                const serverTimeStack = mainStack.addStack();
                serverTimeStack.backgroundColor = new Color("#000000", 0.3); // 第二个参数是透明度, 0-1之间
                serverTimeStack.cornerRadius = 4; // 可选: 添加圆角
                serverTimeStack.setPadding(2, 4, 2, 4); // 可选: 添加内边距（上、右、下、左）

                const serverTimeText = serverTimeStack.addText(`车辆数据: ${serverTimeStr}`);
                serverTimeText.textColor = Color.gray();
                serverTimeText.font = Font.systemFont(widgetFamily === 'small' ? 9 : 11);
                serverTimeText.lineLimit = 1;
                serverTimeText.rightAlignText();

                // 在显示本地更新时间的部分, 添加一个带半透明背景的 stack
                const localUpdateStack = mainStack.addStack();
                localUpdateStack.backgroundColor = new Color("#000000", 0.3); // 第二个参数是透明度, 0-1之间
                localUpdateStack.cornerRadius = 4; // 可选: 添加圆角
                localUpdateStack.setPadding(2, 4, 2, 4); // 可选: 添加内边距（上、右、下、左）

                // 添加本地更新时间文本
                const localUpdateText = localUpdateStack.addText(
                    `本地更新: ${new Date(vehicleData.timestamp).toLocaleString('zh-CN', {
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
            // 设置下次更新时间
            if (config.runsInWidget) {
                const settings = await WidgetSettings.getInstance();
                const updateInterval = settings.updateInterval || 300;
                widget.refreshAfterDate = new Date(Date.now() + updateInterval * 1000);
            }
        } else {
            // 这是无数据的情况, 做一个提示显示
            const text = widget.addText("暂无数据");
            text.textColor = Color.gray();
            text.font = Font.systemFont(14);
        }

    } catch (error) {
        if (config.runsInApp) {
            log(`创建小组件错误: ${error.message}`);
            // const text = widget.addText("加载失败, 请检查配置");
            const text = widget.addText(`${error.message}`);
            text.textColor = Color.orange();
            text.font = Font.mediumSystemFont(14);
        } else if (config.runsInWidget) {
            return null;
        }
    }

    return widget;
}

// 主入口函数
async function main() {
    log("连接账户");
    await JLRConnectAPI.connectByAccountOrToken();
    if (config.runsInWidget) {
        log("在小组件中运行");
        const widgetFamily = config.widgetFamily;
        log(`Widget Family: ${widgetFamily}`);
        // 检查是否需要更新数据
        const vehicleData = await vehicleCache.getInstance();
        if (!vehicleData) {
            log("无缓存数据, 需要更新");
            await MenuManager.renderWidget(false, widgetFamily);
        } else {
            const settings = await WidgetSettings.getInstance();
            const updateInterval = settings.updateInterval || 300;
            const timeSinceUpdate = Math.floor((Date.now() - vehicleData.timestamp) / 1000);

            if (timeSinceUpdate >= updateInterval) {
                log(`数据已过期 ${Math.floor(timeSinceUpdate/60)} 分钟, 开始更新`);
                await MenuManager.renderWidget(false, widgetFamily);
            } else {
                log(`数据未过期, 还剩 ${Math.floor((updateInterval - timeSinceUpdate)/60)} 分钟`);
                await MenuManager.renderWidget(false, widgetFamily);
            }
        }
    } else if (config.runsInApp) {
        log("在应用中运行");
        await MenuManager.showMainMenu();
    }
}

// 运行主函数
await main();

log("脚本执行完成");
Script.complete(); 