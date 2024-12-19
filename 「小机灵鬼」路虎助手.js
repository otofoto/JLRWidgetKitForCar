// Variables used by Scriptable.
// These must be at the very top of the file. Do not edit.
// icon-color: orange; icon-glyph: car;

// Version: 1.0.0 Stable
// Update time: 2024-12-19 18:50:00
// Author: xuyuanfang
// Description: 「小机灵鬼」路虎助手
// Github: https://github.com/xuyuanfang/WidgetKitForCar
// License: GPL-3.0
// Changelog: 初版发布

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
    static async loadCache() {
        const fm = FileManager.local();
        const cachePath = fm.joinPath(fm.documentsDirectory(), 'jlr-cache.json');
        if (fm.fileExists(cachePath)) {
            const cache = JSON.parse(fm.readString(cachePath));
            const config = await ConfigManager.loadConfig();
            const updateInterval = config?.updateInterval || 600; // 默认10分钟

            // 检查缓存是否过期
            if (cache.timestamp) {
                const timeSinceUpdate = Math.floor((Date.now() - cache.timestamp) / 1000);
                const timeLeft = updateInterval - timeSinceUpdate;

                if (timeLeft > 0) {
                    // 显示剩余有效时
                    const minutes = Math.floor(timeLeft / 60);
                    const seconds = timeLeft % 60;
                    log(`缓存有效期还剩: ${minutes}分${seconds}秒`);
                    log(`下次更新时间: ${new Date(cache.timestamp + updateInterval * 1000).toLocaleTimeString('zh-CN')}`);
                    return cache.data;
                }
                log("缓存已过期，需要更新");
            }
        }
        log("无有效缓存，需要获取新数据");
        return null;
    }

    static async saveCache(data) {
        const fm = FileManager.local();
        const cachePath = fm.joinPath(fm.documentsDirectory(), 'jlr-cache.json');
        const timestamp = Date.now();
        fm.writeString(cachePath, JSON.stringify({
            timestamp: timestamp,
            data: data
        }));
        log(`缓存已更新，时间: ${new Date(timestamp).toLocaleTimeString('zh-CN')}`);
    }

    static async generateDeviceId() {
        return UUID.string().replace(/-/g, '').toUpperCase();
    }

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
        log(`等待完成，实际等待了 ${actualWait.toFixed(1)} 秒`);
    }

    static async retry(operation, maxAttempts = 3) {
        let lastError;
        for (let attempt = 0; attempt < maxAttempts; attempt++) {
            try {
                return await operation();
            } catch (error) {
                lastError = error;
                if (attempt === maxAttempts - 1) {
                    throw new Error(`操作失败，已重试 ${maxAttempts} 次: ${error.message}`);
                }
                const delay = 10 * Math.pow(2, attempt); // 10秒, 20秒, 40秒
                log(`第 ${attempt + 1} 次尝试失败，等待 ${delay} 秒后重试`);
                await this.wait(delay);
                log(`开始第 ${attempt + 2} 次尝试`);
            }
        }
        throw lastError;
    }

    static async loadWidgetSize() {
        const fm = FileManager.local();
        const sizePath = fm.joinPath(fm.documentsDirectory(), 'jlr-widget-size.json');
        if (fm.fileExists(sizePath)) {
            return JSON.parse(fm.readString(sizePath));
        }
        return null;
    }

    static async saveWidgetSize(size) {
        const fm = FileManager.local();
        const sizePath = fm.joinPath(fm.documentsDirectory(), 'jlr-widget-size.json');
        fm.writeString(sizePath, JSON.stringify({
            width: size.width,
            height: size.height,
            timestamp: Date.now()
        }));
    }

    static async checkWidgetSize() {
        if (config.runsInWidget) {
            const widget = new ListWidget();
            const currentSize = widget.presentSize();
            const lastSize = await this.loadWidgetSize();

            log("检查小组件尺寸");
            log(`当前尺寸: ${currentSize.width}x${currentSize.height}`);
            if (lastSize) {
                log(`上次尺寸: ${lastSize.width}x${lastSize.height}`);
            }

            if (!lastSize ||
                lastSize.width !== currentSize.width ||
                lastSize.height !== currentSize.height) {
                log("检测到小组件尺寸变化");
                await this.saveWidgetSize(currentSize);
                return true;
            }
        }
        return false;
    }

    static startSizeMonitor() {
        // 每10秒检查一次尺寸
        const timer = new Timer();
        timer.timeInterval = 10;
        timer.schedule(async function() {
            await Utils.checkWidgetSize();
        });
        log("已启动尺寸监控");
    }

    static async getBackgroundImage() {
        const fm = FileManager.local();
        const bgPath = fm.joinPath(fm.documentsDirectory(), 'jlr-background.jpg');
        const configPath = fm.joinPath(fm.documentsDirectory(), 'jlr-background-config.json');

        if (fm.fileExists(bgPath)) {
            const img = fm.readImage(bgPath);

            // 读取模糊配置
            if (fm.fileExists(configPath)) {
                const config = JSON.parse(fm.readString(configPath));
                if (config.blur > 0) {
                    // 创建绘图上下文
                    const drawContext = new DrawContext();
                    drawContext.size = new Size(img.size.width, img.size.height);

                    // 绘制原图
                    drawContext.drawImageInRect(img, new Rect(0, 0, img.size.width, img.size.height));

                    // 叠加半透明层来模拟模糊效果
                    const alpha = config.blur / 100 * 0.8; // 最大透明度0.8
                    drawContext.setFillColor(new Color("#000000", alpha));
                    drawContext.fillRect(new Rect(0, 0, img.size.width, img.size.height));

                    // 返回处理后的图片
                    return drawContext.getImage();
                }
            }
            return img;
        }
        return null;
    }
}

// API 类
class JLRConnectAPI {
    constructor() {
        this._token = null;
        this._deviceId = null;
        this._userId = null;
        this._vehicleId = null;
        this._refreshToken = null;
        this._email = null;
        this._authToken = null;
        this._tokenExpiry = 0;
    }

    // 检查 token 是否过期
    async _checkAndRefreshToken() {
        const config = await ConfigManager.loadConfig();
        const now = Math.floor(Date.now() / 1000);

        // 如果 token 未设置或已过期
        if (!this._token || !this._authToken || now >= config.tokenExpiry) {
            log("Token 已过期或未设置，尝试刷新");
            if (config?.refreshToken) {
                try {
                    const auth = await this._authenticate({
                        grant_type: "refresh_token",
                        refresh_token: config.refreshToken
                    });

                    // 更新 token 信息
                    this._token = auth.access_token;
                    this._refreshToken = auth.refresh_token;
                    this._authToken = auth.authorization_token;
                    this._tokenExpiry = now + parseInt(auth.expires_in);

                    // 保存到配置
                    await ConfigManager.saveConfig({
                        ...config,
                        accessToken: auth.access_token,
                        authToken: auth.authorization_token,
                        refreshToken: auth.refresh_token,
                        tokenExpiry: this._tokenExpiry
                    });

                    log("Token 刷新成功");
                } catch (error) {
                    log("Token 刷新失败，需要重新登录");
                    throw new Error("认证已过期，请重新登录");
                }
            } else {
                throw new Error("未找到有效的认证信息，请重新登录");
            }
        }
    }

    async connect(email, password) {
        log("开始连接...");

        const config = await ConfigManager.loadConfig();
        this._email = email;
        this._deviceId = config?.deviceId || await Utils.generateDeviceId();

        // 尝试使用已有的 token
        if (config?.accessToken && config?.authToken && config?.refreshToken) {
            this._token = config.accessToken;
            this._authToken = config.authToken;
            this._refreshToken = config.refreshToken;
            this._tokenExpiry = config.tokenExpiry;
            this._userId = config.userId;

            try {
                // 检查并刷新 token
                await this._checkAndRefreshToken();

                // 如果没有 userId，重新获取用户信息
                if (!this._userId) {
                    await this._getUserInfo();
                }

                return {
                    access_token: this._token,
                    refresh_token: this._refreshToken,
                    authorization_token: this._authToken
                };
            } catch (error) {
                log("使用缓存 token 失败，尝试密码登录");
            }
        }

        // 使用密码登录
        log("使用密登录");
        const auth = await this._authenticate({
            grant_type: "password",
            username: email,
            password: password
        });

        // 保存认证信息
        this._token = auth.access_token;
        this._refreshToken = auth.refresh_token;
        this._authToken = auth.authorization_token;
        this._tokenExpiry = Math.floor(Date.now() / 1000) + parseInt(auth.expires_in);

        // 客端
        await this._registerClient();

        // 获取用户信息
        await this._getUserInfo();

        // 保存到配置，包括 userId
        await ConfigManager.saveConfig({
            ...config,
            accessToken: auth.access_token,
            authToken: auth.authorization_token,
            refreshToken: auth.refresh_token,
            tokenExpiry: this._tokenExpiry,
            deviceId: this._deviceId,
            userId: this._userId
        });

        return auth;
    }

    async _authenticate(data) {
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
                log("使用 refresh token");
            }

            request.body = JSON.stringify(data);
            request.timeoutInterval = 30;

            const response = await request.loadString();
            log("收到认证响应");

            if (!response || response.trim().length === 0) {
                throw new Error('认证响应为空');
            }

            const jsonResponse = JSON.parse(response);
            log("认证成功");

            if (!jsonResponse.access_token || !jsonResponse.refresh_token) {
                throw new Error('认证响应缺少必要字段');
            }

            return jsonResponse;
        });
    }

    async _registerClient() {
        return await Utils.retry(async () => {
            await this._checkAndRefreshToken();
            const url = `${API_CONFIG.baseUrls.IFOP}/users/${this._email}/clients`;
            log(`注册客户端 URL: ${url}`);

            const request = new Request(url);
            request.method = "POST";
            request.headers = {
                "Host": "ifop.prod-chn.jlrmotor.com",
                "Authorization": `Bearer ${this._token}`,
                "Content-Type": "application/json",
                "Accept": "*/*",
                "X-Device-Id": this._deviceId,
                "x-telematicsprogramtype": "jlrpy",
                "x-App-Id": "ICR_JAGUAR_ANDROID",
                "x-App-Secret": "7bf6f544-1926-4714-8066-ceceb40d538d"
            };

            const data = {
                access_token: this._token,
                authorization_token: this._authToken,
                expires_in: "86400",
                deviceID: this._deviceId
            };

            request.body = JSON.stringify(data);
            request.timeoutInterval = 30;
            log("发送注册客户端请求");

            const response = await request.loadString();
            if (response && response.trim().length > 0) {
                log("收到注册响应");
            }
            log("客户端注册完成");
        });
    }

    async _getUserInfo() {
        return await Utils.retry(async () => {
            await this._checkAndRefreshToken();
            const url = `${API_CONFIG.baseUrls.IFOA}/if9/jlr/users?loginName=${this._email}`;
            log(`获取用户信息 URL: ${url}`);

            const request = new Request(url);
            request.method = "GET";
            request.timeoutInterval = 30; // 设置30秒超时
            request.headers = {
                "Host": "ifoa.prod-chn.jlrmotor.com",
                "Authorization": `Bearer ${this._token}`,
                "Accept": "application/vnd.wirelesscar.ngtp.if9.User-v3+json",
                "Content-Type": "application/json",
                "X-Device-Id": this._deviceId,
                "x-telematicsprogramtype": "jlrpy",
                "x-App-Id": "ICR_JAGUAR_ANDROID",
                "x-App-Secret": "7bf6f544-1926-4714-8066-ceceb40d538d"
            };

            const response = await request.loadString();
            log(`用户信息响应: ${response}`);

            const data = JSON.parse(response);
            if (!data.userId) {
                throw new Error('获取用户ID失败');
            }

            this._userId = data.userId;
            log(`获取到用户ID: ${this._userId}`);

            return data;
        });
    }

    async getVehicleList() {
        return await Utils.retry(async () => {
            await this._checkAndRefreshToken();
            const url = `${API_CONFIG.baseUrls.IFOA}/if9/jlr/users/${this._userId}/vehicles?primaryOnly=true`;
            log(`获取车辆列表 URL: ${url}`);

            const request = new Request(url);
            request.method = "GET";
            request.headers = {
                "Host": "ifoa.prod-chn.jlrmotor.com",
                "Authorization": `Bearer ${this._token}`,
                "Accept": "*/*",
                "Content-Type": "application/json",
                "X-Device-Id": this._deviceId,
                "x-telematicsprogramtype": "jlrpy",
                "x-App-Id": "ICR_JAGUAR_ANDROID",
                "x-App-Secret": "7bf6f544-1926-4714-8066-ceceb40d538d"
            };
            request.timeoutInterval = 30;

            const response = await request.loadString();
            log(`车辆列表响应: ${response}`);

            const data = JSON.parse(response);
            return data.vehicles;
        });
    }

    async getVehicleAttributes(vin) {
        return await Utils.retry(async () => {
            await this._checkAndRefreshToken();
            const url = `${API_CONFIG.baseUrls.IFOA}/if9/jlr/vehicles/${vin}/attributes`;
            log(`获取车辆属性 URL: ${url}`);

            const request = new Request(url);
            request.method = "GET";
            request.headers = {
                "Host": "ifoa.prod-chn.jlrmotor.com",
                "Authorization": `Bearer ${this._token}`,
                "Accept": "application/vnd.ngtp.org.VehicleAttributes-v8+json",
                "Content-Type": "application/json",
                "X-Device-Id": this._deviceId,
                "x-telematicsprogramtype": "jlrpy",
                "x-App-Id": "ICR_JAGUAR_ANDROID",
                "x-App-Secret": "7bf6f544-1926-4714-8066-ceceb40d538d"
            };
            request.timeoutInterval = 30;

            const response = await request.loadString();
            log(`车辆属性响应: ${response}`);
            return JSON.parse(response);
        });
    }

    async getVehicleStatus(vin) {
        return await Utils.retry(async () => {
            await this._checkAndRefreshToken();
            const url = `${API_CONFIG.baseUrls.IFOA}/if9/jlr/vehicles/${vin}/status?includeInactive=true`;
            log(`获取车辆状态 URL: ${url}`);

            const request = new Request(url);
            request.method = "GET";
            request.headers = {
                "Host": "ifoa.prod-chn.jlrmotor.com",
                "Authorization": `Bearer ${this._token}`,
                "Accept": "application/vnd.ngtp.org.if9.healthstatus-v4+json",
                "Content-Type": "application/json",
                "X-Device-Id": this._deviceId,
                "x-telematicsprogramtype": "jlrpy",
                "x-App-Id": "ICR_JAGUAR_ANDROID",
                "x-App-Secret": "7bf6f544-1926-4714-8066-ceceb40d538d"
            };
            request.timeoutInterval = 30;

            const response = await request.loadString();
            log(`车辆状态响应: ${response}`);
            return JSON.parse(response);
        });
    }

    async getVehiclePosition(vin) {
        return await Utils.retry(async () => {
            await this._checkAndRefreshToken();
            const url = `${API_CONFIG.baseUrls.IFOA}/if9/jlr/vehicles/${vin}/position`;
            log(`获取车辆位置 URL: ${url}`);

            const request = new Request(url);
            request.method = "GET";
            request.headers = {
                "Host": "ifoa.prod-chn.jlrmotor.com",
                "Authorization": `Bearer ${this._token}`,
                "Accept": "*/*",
                "Content-Type": "application/json",
                "X-Device-Id": this._deviceId,
                "x-telematicsprogramtype": "jlrpy",
                "x-App-Id": "ICR_JAGUAR_ANDROID",
                "x-App-Secret": "7bf6f544-1926-4714-8066-ceceb40d538d"
            };
            request.timeoutInterval = 30;

            const response = await request.loadString();
            log(`车辆位置响应: ${response}`);
            return JSON.parse(response);
        });
    }
}

// 配置管理类
class ConfigManager {
    static async loadConfig() {
        const fm = FileManager.local();
        const configPath = fm.joinPath(fm.documentsDirectory(), 'jlr-config.json');
        if (fm.fileExists(configPath)) {
            return JSON.parse(fm.readString(configPath));
        }
        return null;
    }

    static async saveConfig(config) {
        const fm = FileManager.local();
        const configPath = fm.joinPath(fm.documentsDirectory(), 'jlr-config.json');
        fm.writeString(configPath, JSON.stringify(config));
    }

    static async showMainMenu() {
        const alert = new Alert();
        alert.title = "路虎出行";

        // 获取并显示当前更新周期
        const config = await this.loadConfig();
        const updateInterval = config?.updateInterval || 600;
        let intervalText = "10分钟";  // 默认值

        // 转换更新周期显示
        if (updateInterval === 600) {
            intervalText = "10分钟";
        } else if (updateInterval === 1800) {
            intervalText = "30分钟";
        } else if (updateInterval === 3600) {
            intervalText = "1小时";
        } else if (updateInterval === 7200) {
            intervalText = "2小时";
        } else if (updateInterval === 10800) {
            intervalText = "3小时";
        } else if (updateInterval < 600) {
            intervalText = `${updateInterval}秒`;
        }

        alert.message = `当前更新周期: ${intervalText}\n请选择操作`;

        alert.addAction("登录设置");
        alert.addAction("车辆选择");
        alert.addAction("更新周期");
        alert.addAction("更新数据");
        alert.addAction("清除缓存");
        alert.addAction("预览组件");
        alert.addAction("刷新组件");
        alert.addAction("背景设置");
        alert.addAction("检查更新");
        alert.addAction("关于版权");
        alert.addCancelAction("取消");

        const idx = await alert.present();
        switch (idx) {
            case 0:
                return await this.showConfigSheet();
            case 1:
                return await this.showVehicleSelect();
            case 2:
                return await this.showUpdateIntervalSelect();
            case 3:
                return await this.updateData();
            case 4:
                return await this.clearCache();
            case 5:
                return await this.previewWidget();
            case 6:
                return await this.refreshWidget();
            case 7:
                return await this.setBackgroundImage();
            case 8:
                return await this.checkUpdate();
            case 9:
                return await this.showCopyright();
        }
        return null;
    }

    static async showConfigSheet() {
        const alert = new Alert();
        alert.title = "登录设置";
        alert.message = "请填写登录信息";

        const config = await this.loadConfig();
        alert.addTextField("邮箱", config?.username || "");
        alert.addSecureTextField("密码", config?.password || "");

        alert.addAction("保存");
        alert.addCancelAction("取消");

        const idx = await alert.present();
        if (idx === 0) {
            const newConfig = {
                ...config,
                username: alert.textFieldValue(0),
                password: alert.textFieldValue(1),
                refreshToken: null  // 清除旧的 refresh token
            };
            await this.saveConfig(newConfig);

            try {
                const api = new JLRConnectAPI();
                await api.connect(newConfig.username, newConfig.password);
                await this.showVehicleSelect();
            } catch (error) {
                const errorAlert = new Alert();
                errorAlert.title = "登录失败";
                errorAlert.message = error.message;
                errorAlert.addAction("确定");
                await errorAlert.present();
            }

            return newConfig;
        }
        return null;
    }

    static async showVehicleSelect() {
        try {
            const api = new JLRConnectAPI();
            const config = await this.loadConfig();
            await api.connect(config.username, config.password);
            const vehicles = await api.getVehicleList();

            if (!vehicles || vehicles.length === 0) {
                const alert = new Alert();
                alert.title = "错误";
                alert.message = "未找到车辆";
                alert.addAction("确定");
                await alert.present();
                return;
            }

            const alert = new Alert();
            alert.title = "选择车辆";
            alert.message = "请选择要控制的车辆";

            vehicles.forEach(vehicle => {
                alert.addAction(vehicle.vin);
            });
            alert.addCancelAction("取消");

            const idx = await alert.present();
            if (idx !== -1) {
                const selectedVehicle = vehicles[idx];
                const newConfig = {
                    ...config,
                    vehicleId: selectedVehicle.vin
                };
                await this.saveConfig(newConfig);
                return selectedVehicle;
            }
        } catch (error) {
            const alert = new Alert();
            alert.title = "错误";
            alert.message = error.message;
            alert.addAction("确定");
            await alert.present();
        }
        return null;
    }

    static async showUpdateIntervalSelect() {
        const alert = new Alert();
        alert.title = "更新周期";
        alert.message = "请选择数据更新周期";

        const intervals = [
            { name: "10分钟", value: 600 },
            { name: "30分钟", value: 1200 },
            { name: "1小时", value: 3600 },
            { name: "2小时", value: 7200 },
            { name: "3小时", value: 10800 }
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
                inputAlert.addTextField("秒数", "600");
                inputAlert.addAction("确定");
                inputAlert.addCancelAction("取消");

                const inputResult = await inputAlert.present();

                if (inputResult === 0) {
                    const inputValue = parseInt(inputAlert.textFieldValue(0));

                    // 验证输入值
                    if (isNaN(inputValue) || inputValue < 30 || inputValue > 600) {
                        const errorAlert = new Alert();
                        errorAlert.title = "输入错误";
                        errorAlert.message = "请输入30-3600之间的秒数";
                        errorAlert.addAction("确定");
                        await errorAlert.present();
                        return;
                    }

                    updateInterval = inputValue;
                } else {
                    return;
                }
            }

            // 保存配置
            const config = await this.loadConfig();
            const newConfig = {
                ...config,
                updateInterval: updateInterval
            };
            await this.saveConfig(newConfig);

            // 显示成功消息
            const successAlert = new Alert();
            successAlert.title = "已更新";
            successAlert.message = `更新周期已设置为${updateInterval}秒`;
            successAlert.addAction("确定");
            await successAlert.present();
        }
    }

    static async updateData() {
        try {
            const config = await this.loadConfig();
            if (!config || !config.username || !config.password) {
                throw new Error("请先完成登录设置");
            }

            const api = new JLRConnectAPI();
            await api.connect(config.username, config.password);

            // 获取所有需要的车辆信息
            const vehicles = await api.getVehicleList();
            const vehicle = vehicles.find(v => v.vin === config.vehicleId) || vehicles[0];

            // 获取车辆详细信息
            const attributes = await api.getVehicleAttributes(vehicle.vin);
            const status = await api.getVehicleStatus(vehicle.vin);
            const position = await api.getVehiclePosition(vehicle.vin);

            // 保存到缓存
            await Utils.saveCache({
                vehicles,
                attributes,
                status,
                position,
                lastUpdate: new Date().toLocaleString('zh-CN'),
                timestamp: Date.now()
            });

            // 重新渲染小组件
            const widget = await createWidget(true);
            Script.setWidget(widget);

            const alert = new Alert();
            alert.title = "更新成功";
            alert.message = `已更新车辆信息:\n${attributes.vehicleBrand} ${attributes.nickname || attributes.vehicleType}\n更新时间: ${new Date().toLocaleString('zh-CN')}`;
            alert.addAction("确定");
            await alert.present();

        } catch (error) {
            const alert = new Alert();
            alert.title = "更新失败";
            alert.message = error.message;
            alert.addAction("确定");
            await alert.present();
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
                        const unsupportedAlert = new Alert();
                        unsupportedAlert.title = "暂不支持";
                        unsupportedAlert.message = "超大尺寸组件暂不支持预览";
                        unsupportedAlert.addAction("确定");
                        await unsupportedAlert.present();
                        break;
                }
            }
        } catch (error) {
            const alert = new Alert();
            alert.title = "预览失败";
            alert.message = error.message;
            alert.addAction("确定");
            await alert.present();
        }
    }

    static async clearCache() {
        try {
            const fm = FileManager.local();
            const cachePath = fm.joinPath(fm.documentsDirectory(), 'jlr-cache.json');

            if (fm.fileExists(cachePath)) {
                fm.remove(cachePath);

                // 重新渲染小组件
                const widget = await createWidget(false);  // 使用 false 强制获取新数据
                Script.setWidget(widget);

                const alert = new Alert();
                alert.title = "清除成功";
                alert.message = "缓存已清除";
                alert.addAction("确定");
                await alert.present();
            } else {
                const alert = new Alert();
                alert.title = "提示";
                alert.message = "没有找到缓存文件";
                alert.addAction("确定");
                await alert.present();
            }
        } catch (error) {
            const alert = new Alert();
            alert.title = "清除失败";
            alert.message = error.message;
            alert.addAction("确定");
            await alert.present();
        }
    }

    static async savePreferredSize(size) {
        const config = await this.loadConfig();
        const newConfig = {
            ...config,
            preferredWidgetSize: size
        };
        await this.saveConfig(newConfig);
    }

    static async getPreferredSize() {
        const config = await this.loadConfig();
        return config?.preferredWidgetSize || 'medium';
    }

    static async checkUpdate() {
        try {
            // 先让用户选择版本类型
            const versionAlert = new Alert();
            versionAlert.title = "选择版本";
            versionAlert.message = "请选择要检查的版本类型\n\n稳定版：经过完整测试的正式版本\n开发版：包含最新功能的测试版本";

            versionAlert.addAction("稳定版");
            versionAlert.addAction("开发版");
            versionAlert.addCancelAction("取消");

            const choice = await versionAlert.present();

            if (choice !== -1) {
                // 获取本地配置中的 refresh_token
                const config = await ConfigManager.loadConfig();
                if (!config?.refreshToken) {
                    throw new Error("未找到有效的认证信息，请先登录");
                }

                // 根据选择设置不同的更新检查URL
                const updateUrl = choice === 0
                    ? `${API_CONFIG.extendUrl}/scriptable/update/stable`  // 稳定版URL
                    : `${API_CONFIG.extendUrl}/scriptable/update/dev`;    // 开发版URL

                // 创建 POST 请求
                const request = new Request(updateUrl);
                request.method = "POST";
                request.headers = {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${config.refreshToken}`
                };
                request.timeoutInterval = 10;

                // 添加请求体
                request.body = JSON.stringify({
                    currentVersion: "1.0.0",
                    platform: "iOS",
                    deviceModel: Device.model(),
                    systemVersion: Device.systemVersion()
                });

                // 发送请求并获取响应
                const response = await request.loadString();
                log(`更新检查响应: ${response}`);

                // 解析响应
                const updateInfo = JSON.parse(response);

                const alert = new Alert();

                if (updateInfo.hasUpdate) {
                    // 有更新时显示更新确认对话框
                    alert.title = "发现新版本";
                    alert.message = `当前版本: ${updateInfo.currentVersion}\n最新版本: ${updateInfo.latestVersion}\n版本类型: ${choice === 0 ? '稳定版' : '开发版'}\n\n更新内容:\n${updateInfo.changelog}`;
                    alert.addAction("立即更新");
                    alert.addCancelAction("取消");

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
                        const successAlert = new Alert();
                        successAlert.title = "更新成功";
                        successAlert.message = `脚本已更新到最新${choice === 0 ? '稳定' : '开发'}版本，请重新运行脚本`;
                        successAlert.addAction("确定");
                        await successAlert.present();

                        // 退出脚本
                        Script.complete();
                    }
                } else {
                    // 无更新时显示提示
                    alert.title = "检查更新";
                    alert.message = updateInfo.message || "当前已是最新版本";
                    alert.addAction("确定");
                    await alert.present();
                }
            }
        } catch (error) {
            const alert = new Alert();
            alert.title = "检查更新失败";
            alert.message = error.message;
            alert.addAction("确定");
            await alert.present();
        }
    }

    static async refreshWidget() {
        try {
            // 刷新所有已添加的小组件
            const widget = await createWidget(true);
            Script.setWidget(widget);

            const alert = new Alert();
            alert.title = "刷新成功";
            alert.message = "小组件已重新渲染";
            alert.addAction("确定");
            await alert.present();
        } catch (error) {
            const alert = new Alert();
            alert.title = "刷新失败";
            alert.message = error.message;
            alert.addAction("确定");
            await alert.present();
        }
    }

    static async setBackgroundImage() {
        try {
            const imgPicker = new Alert();
            imgPicker.title = "设置背景图片";
            imgPicker.message = "请选择操作";

            imgPicker.addAction("从相册选择");
            imgPicker.addAction("从iCloud选择");  // 改为iCloud选择
            imgPicker.addAction("设置暗度");
            imgPicker.addAction("恢复默认背景");
            imgPicker.addCancelAction("取消");

            const choice = await imgPicker.present();

            const fm = FileManager.local();
            const bgPath = fm.joinPath(fm.documentsDirectory(), 'jlr-background.jpg');
            const configPath = fm.joinPath(fm.documentsDirectory(), 'jlr-background-config.json');

            if (choice === 0) {
                // 从相册选择图片
                const img = await Photos.fromLibrary();
                fm.writeImage(bgPath, img);
                await this.setBackgroundBlur();

                // 重新渲染小组件
                const widget = await createWidget(true);
                Script.setWidget(widget);

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
                    const alert = new Alert();
                    alert.title = "未找到图片";
                    alert.message = "请先将图片文件放到iCloud Drive的Scriptable文件夹中";
                    alert.addAction("确定");
                    await alert.present();
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

                            // 重新渲染小组件
                            const widget = await createWidget(true);
                            Script.setWidget(widget);
                        } else {
                            throw new Error("无法读取所选图片");
                        }
                    }
                }

            } else if (choice === 2) {
                // 设置已有图片的暗度
                if (!fm.fileExists(bgPath)) {
                    const alert = new Alert();
                    alert.title = "错误";
                    alert.message = "请先设置背景图片";
                    alert.addAction("确定");
                    await alert.present();
                    return;
                }
                await this.setBackgroundBlur();

            } else if (choice === 3) {
                // 删除自定义背景和配置，恢复默认
                if (fm.fileExists(bgPath)) {
                    fm.remove(bgPath);
                }
                if (fm.fileExists(configPath)) {
                    fm.remove(configPath);
                }

                // 重新渲染小组件
                const widget = await createWidget(true);
                Script.setWidget(widget);

                const alert = new Alert();
                alert.title = "已恢复默认";
                alert.message = "已恢复默认背景";
                alert.addAction("确定");
                await alert.present();
            }
        } catch (error) {
            const alert = new Alert();
            alert.title = "设置失败";
            alert.message = error.message;
            alert.addAction("确定");
            await alert.present();
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
            // 用户选择自定义数值，显示输入框
            return await this.setCustomBlur();
        } else if (choice !== -1) {
            // 使用预设值
            const presetValues = [25, 50, 75];
            const blurValue = presetValues[choice];

            // 保存暗度配置
            const fm = FileManager.local();
            const configPath = fm.joinPath(fm.documentsDirectory(), 'jlr-background-config.json');
            fm.writeString(configPath, JSON.stringify({ blur: blurValue }));

            // 重新渲染小组件
            const widget = await createWidget(true);
            Script.setWidget(widget);

            const successAlert = new Alert();
            successAlert.title = "设置成功";
            successAlert.message = `背景暗度已设置为${blurValue}`;
            successAlert.addAction("确定");
            await successAlert.present();
        }
    }

    // 自定义数值输入
    static async setCustomBlur() {
        const alert = new Alert();
        alert.title = "自定义暗度";
        alert.message = "请输入背景暗度(0-100)\n0表示原图显示, 100表示最暗";

        // 读取当前暗度
        const fm = FileManager.local();
        const configPath = fm.joinPath(fm.documentsDirectory(), 'jlr-background-config.json');
        let currentBlur = 0;

        if (fm.fileExists(configPath)) {
            const config = JSON.parse(fm.readString(configPath));
            currentBlur = config.blur || 0;
        }

        alert.addTextField("暗度", currentBlur.toString());
        alert.addAction("确定");
        alert.addCancelAction("取消");

        const idx = await alert.present();

        if (idx === 0) {
            const blurValue = parseInt(alert.textFieldValue(0));

            // 验证输入值
            if (isNaN(blurValue) || blurValue < 0 || blurValue > 100) {
                const errorAlert = new Alert();
                errorAlert.title = "输入错误";
                errorAlert.message = "请输入0-100之间的数值";
                errorAlert.addAction("确定");
                await errorAlert.present();
                return;
            }

            // 保存暗度配置
            fm.writeString(configPath, JSON.stringify({
                blur: blurValue
            }));

            // 重新渲染小组件
            const widget = await createWidget(true);
            Script.setWidget(widget);

            const successAlert = new Alert();
            successAlert.title = "设置成功";
            successAlert.message = `背景暗度已设置为${blurValue}`;
            successAlert.addAction("确定");
            await successAlert.present();
        }
    }

    // 添加显示版权声明的方法
    static async showCopyright() {
        const alert = new Alert();
        alert.title = "开源声明";
        alert.message = "路虎出行小组件\n\n" +
            "本项目是一个由@xuyuanfang发起的开源项目，遵循 GPL-3.0 开源许可证。\n\n" +
            "项目仓库地址：\nhttps://github.com/xuyuanfang/WidgetKitForCar\n\n" +
            "欢迎访问项目仓库获取最新版本，提交问题反馈或参与贡献。\n" +
            "您可以自由使用、修改和分发本项目，但衍生作品必须以相同方式开源。\n\n" +
            "声明：Land Rover、路虎以及其Logo均为捷豹路虎汽车有限公司的注册商标。\n" +
            "本项目为非官方工具，与捷豹路虎汽车有限公司无关。";

        alert.addAction("确定");
        await alert.present();
    }
}

// 主函数
async function createWidget(useCache = false, family = null) {
    log("开始创建小组件");
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
        const config = await ConfigManager.loadConfig();
        log("加载配置信息");

        // 确定小组件尺寸
        let widgetFamily = family || args.widgetFamily || 'medium';
        log(`使用小组件尺寸: ${widgetFamily}`);

        if (!config || !config.username || !config.password) {
            log("未找到配置信息");
            const text = widget.addText("请先登录设置");
            text.textColor = Color.white();
            text.font = Font.mediumSystemFont(14);
            return widget;
        }

        // 获取数据
        let vehicleData = await Utils.loadCache();
        if (!vehicleData && !useCache) {
            log("获取新数据");
            const api = new JLRConnectAPI();
            await api.connect(config.username, config.password);

            // 获取所有需要的车辆信息
            const vehicles = await api.getVehicleList();
            const vehicle = vehicles.find(v => v.vin === config.vehicleId) || vehicles[0];
            const attributes = await api.getVehicleAttributes(vehicle.vin);
            const status = await api.getVehicleStatus(vehicle.vin);
            const position = await api.getVehiclePosition(vehicle.vin);

            vehicleData = {
                vehicles,
                attributes,
                status,
                position,
                lastUpdate: new Date().toLocaleString('zh-CN'),
                timestamp: Date.now()
            };

            // 保存到缓存
            await Utils.saveCache(vehicleData);
            log("新数据已保存到缓存");
        }

        if (vehicleData?.vehicles?.length > 0 && vehicleData.status && vehicleData.attributes) {
            const vehicle = vehicleData.vehicles.find(v => v.vin === config.vehicleId) || vehicleData.vehicles[0];
            const status = vehicleData.status;
            const attributes = vehicleData.attributes;

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
                    const serverUpdateTime = status.lastUpdatedTime;

                    log(`原始服务器时间: ${serverUpdateTime}`);
                    if (!serverUpdateTime) {
                        // 如果还是找不到，记录完整的状态数据以便调试
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

                const serverTimeText = mainStack.addText(`车辆数据: ${serverTimeStr}`);
                serverTimeText.textColor = Color.gray();
                serverTimeText.font = Font.systemFont(widgetFamily === 'small' ? 9 : 11);
                serverTimeText.lineLimit = 1;
                serverTimeText.rightAlignText();

                // 本地更新时间
                const localTimeText = mainStack.addText(
                    `本地更新: ${new Date(vehicleData.timestamp).toLocaleString('zh-CN', {
                        month: '2-digit',
                        day: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit',
                        hourCycle: 'h23'
                    }).replace(/\//g, '-')}`
                );
                localTimeText.textColor = Color.gray();
                localTimeText.font = Font.systemFont(widgetFamily === 'small' ? 9 : 11);
                localTimeText.lineLimit = 1;
                localTimeText.rightAlignText();
            }
            // 设置下次更新时间
            if (config.runsInWidget) {
                const updateInterval = config?.updateInterval || 600;
                widget.refreshAfterDate = new Date(Date.now() + updateInterval * 1000);
            }
        }

    } catch (error) {
        log(`创建小组件错误: ${error.message}`);
        const text = widget.addText("加载失败，请检查配置");
        text.textColor = Color.orange();
        text.font = Font.mediumSystemFont(14);
    }

    return widget;
}

// 运行入口
if (config.runsInWidget) {
    log("在小组件中运行");
    const widgetFamily = config.widgetFamily;
    log(`Widget Family: ${widgetFamily}`);
    
    // 检查是否需要更新数据
    const cache = await Utils.loadCache();
    if (!cache) {
        log("无缓存数据，需要更新");
        const widget = await createWidget(false, widgetFamily);  // 传入实际的小组件尺寸
        Script.setWidget(widget);
    } else {
        const config = await ConfigManager.loadConfig();
        const updateInterval = config?.updateInterval || 600;
        const timeSinceUpdate = Math.floor((Date.now() - cache.timestamp) / 1000);
        
        if (timeSinceUpdate >= updateInterval) {
            log(`数据已过期 ${Math.floor(timeSinceUpdate/60)} 分钟，开始更新`);
            const widget = await createWidget(false, widgetFamily);  // 传入实际的小组件尺寸
            Script.setWidget(widget);
        } else {
            log(`数据未过期，还剩 ${Math.floor((updateInterval - timeSinceUpdate)/60)} 分钟`);
            const widget = await createWidget(true, widgetFamily);  // 传入际的小组件尺寸
            Script.setWidget(widget);
        }
    }
} else {
    log("在应用中运行");
    await ConfigManager.showMainMenu();
}

log("脚本执行完成");
Script.complete(); 