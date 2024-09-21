const fs = require('fs');
const path = require('path');
const axios = require('axios');
const colors = require('colors');
const { HttpsProxyAgent } = require('https-proxy-agent');
const { Worker, isMainThread, parentPort, workerData } = require('worker_threads');

class Binance {
    constructor(accountIndex, queryString, proxy) {
        this.accountIndex = accountIndex;
        this.queryString = queryString;
        this.proxy = proxy;
        this.proxyIP = "Unknown";
        this.headers = {
            "Accept": "*/*",
            "Accept-Encoding": "gzip, deflate, br",
            "Accept-Language": "vi-VN,vi;q=0.9,fr-FR;q=0.8,fr;q=0.7,en-US;q=0.6,en;q=0.5",
            "Content-Type": "application/json",
            "Origin": "https://www.binance.com",
            "Referer": "https://www.binance.com/vi/game/tg/moon-bix",
            "Sec-Ch-Ua": '"Not/A)Brand";v="99", "Google Chrome";v="115", "Chromium";v="115"',
            "Sec-Ch-Ua-Mobile": "?1",
            "Sec-Ch-Ua-Platform": '"Android"',
            "User-Agent": this.getRandomAndroidUserAgent()
        };
        this.game_response = null;
        this.game = null;
    }

    getRandomAndroidUserAgent() {
        const androidUserAgents = [
            "Mozilla/5.0 (Linux; Android 10; SM-G975F) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.120 Mobile Safari/537.36",
            "Mozilla/5.0 (Linux; Android 11; Pixel 4) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/92.0.4515.159 Mobile Safari/537.36",
            "Mozilla/5.0 (Linux; Android 12; SM-G998B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/93.0.4577.62 Mobile Safari/537.36",
            "Mozilla/5.0 (Linux; Android 11; OnePlus 9 Pro) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.164 Mobile Safari/537.36",
            "Mozilla/5.0 (Linux; Android 10; Redmi Note 9 Pro) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/92.0.4515.131 Mobile Safari/537.36"
        ];
        return androidUserAgents[Math.floor(Math.random() * androidUserAgents.length)];
    }

    async log(msg, type = 'info') {
        const timestamp = new Date().toLocaleTimeString();
        const accountPrefix = `[Pemulung ${this.accountIndex + 1}]`;
        const ipPrefix = this.proxyIP ? `[${this.proxyIP}]` : '[Unknown IP]';
        let logMessage = '';
        
        switch(type) {
            case 'success':
                logMessage = `${accountPrefix}${ipPrefix} ${msg}`.green;
                break;
            case 'error':
                logMessage = `${accountPrefix}${ipPrefix} ${msg}`.red;
                break;
            case 'warning':
                logMessage = `${accountPrefix}${ipPrefix} ${msg}`.yellow;
                break;
            case 'custom':
                logMessage = `${accountPrefix}${ipPrefix} ${msg}`.magenta;
                break;
            default:
                logMessage = `${accountPrefix}${ipPrefix} ${msg}`.blue;
        }
        
        console.log(`[${timestamp}] ${logMessage}`);
    }

    createAxiosInstance() {
        const proxyAgent = new HttpsProxyAgent(this.proxy);
        return axios.create({
            headers: this.headers,
            httpsAgent: proxyAgent
        });
    }

    async checkProxyIP() {
        try {
            const proxyAgent = new HttpsProxyAgent(this.proxy);
            const response = await axios.get('https://api.ipify.org?format=json', { httpsAgent: proxyAgent });
            if (response.status === 200) {
                this.proxyIP = response.data.ip;
            } else {
                throw new Error(`Tidak dapat memeriksa IP proxy. Status code: ${response.status}`);
            }
        } catch (error) {
            throw new Error(`Error memeriksa IP proxy: ${error.message}`);
        }
    }

    async callBinanceAPI(queryString, axios) {
        const accessTokenUrl = "https://www.binance.com/bapi/growth/v1/friendly/growth-paas/third-party/access/accessToken";
        const userInfoUrl = "https://www.binance.com/bapi/growth/v1/friendly/growth-paas/mini-app-activity/third-party/user/user-info";

        try {
            const accessTokenResponse = await axios.post(accessTokenUrl, {
                queryString: queryString,
                socialType: "telegram"
            });

            if (accessTokenResponse.data.code !== "000000" || !accessTokenResponse.data.success) {
                throw new Error(`Gagal mendapatkan akses token: ${accessTokenResponse.data.message}`);
            }

            const accessToken = accessTokenResponse.data.data.accessToken;
            const userInfoHeaders = {
                ...this.headers,
                "X-Growth-Token": accessToken
            };

            const userInfoResponse = await axios.post(userInfoUrl, {
                resourceId: 2056
            }, { headers: userInfoHeaders });

            if (userInfoResponse.data.code !== "000000" || !userInfoResponse.data.success) {
                throw new Error(`Gagal mendapatkan info pengguna: ${userInfoResponse.data.message}`);
            }

            return { userInfo: userInfoResponse.data.data, accessToken };
        } catch (error) {
            this.log(`API call failed: ${error.message}`, 'error');
            return null;
        }
    }

    async startGame(accessToken, axios) {
        try {
            const response = await axios.post(
                'https://www.binance.com/bapi/growth/v1/friendly/growth-paas/mini-app-activity/third-party/game/start',
                { resourceId: 2056 },
                { headers: { ...this.headers, "X-Growth-Token": accessToken } }
            );

            this.game_response = response.data;

            if (response.data.code === '000000') {
                this.log("Mulai permainan, jangan tutup sebelum selesai", 'success');
                return true;
            }

            if (response.data.code === '116002') {
                this.log("Tidak cukup untuk bermain", 'warning');
            } else {
                this.log("Kesalahan saat memulai permainan!", 'error');
            }

            return false;
        } catch (error) {
            this.log(`Tidak dapat memulai permainan: ${error.message}`, 'error');
            return false;
        }
    }

    async gameData() {
        try {
            const response = await axios.post('https://vemid42929.pythonanywhere.com/api/v1/moonbix/play', this.game_response);

            if (response.data.message === 'success') {
                this.game = response.data.game;
                return true;
            }

            this.log(response.data.message, 'warning');
            return false;
        } catch (error) {
            this.log(`Terjadi kesalahan saat menerima data game: ${error.message}`, 'error');
            return false;
        }
    }

    async completeGame(accessToken, axios) {
        try {
            const response = await axios.post(
                'https://www.binance.com/bapi/growth/v1/friendly/growth-paas/mini-app-activity/third-party/game/complete',
                {
                    resourceId: 2056,
                    payload: this.game.payload,
                    log: this.game.log
                },
                { headers: { ...this.headers, "X-Growth-Token": accessToken } }
            );

            if (response.data.code === '000000' && response.data.success) {
                this.log(`Berhasil menyelesaikan permainan | Menerima ${this.game.log} poin`, 'custom');
                return true;
            }

            this.log(`Tidak dapat menyelesaikan permainan: ${response.data.message}`, 'error');
            return false;
        } catch (error) {
            this.log(`Kesalahan saat menyelesaikan permainan: ${error.message}`, 'error');
            return false;
        }
    }

    async getTaskList(accessToken, axios) {
        const taskListUrl = "https://www.binance.com/bapi/growth/v1/friendly/growth-paas/mini-app-activity/third-party/task/list";
        try {
            const response = await axios.post(taskListUrl, {
                resourceId: 2056
            }, {
                headers: {
                    ...this.headers,
                    "X-Growth-Token": accessToken
                }
            });

            if (response.data.code !== "000000" || !response.data.success) {
                throw new Error(`Tidak dapat memperoleh daftar task: ${response.data.message}`);
            }

            const taskList = response.data.data.data[0].taskList.data;
            const resourceIds = taskList
                .filter(task => task.completedCount === 0)
                .map(task => task.resourceId);
            
            return resourceIds;
        } catch (error) {
            this.log(`Tidak dapat memperoleh daftar task: ${error.message}`, 'error');
            return null;
        }
    }

    async completeTask(accessToken, resourceId, axios) {
        const completeTaskUrl = "https://www.binance.com/bapi/growth/v1/friendly/growth-paas/mini-app-activity/third-party/task/complete";
        try {
            const response = await axios.post(completeTaskUrl, {
                resourceIdList: [resourceId],
                referralCode: null
            }, {
                headers: {
                    ...this.headers,
                    "X-Growth-Token": accessToken
                }
            });

            if (response.data.code !== "000000" || !response.data.success) {
                throw new Error(`Tidak dapat menyelesaikan task: ${response.data.message}`);
            }

            if (response.data.data.type) {
                this.log(`Menyelesaikan task ${response.data.data.type} berhasil!`, 'success');
            }

            return true;
        } catch (error) {
            this.log(`Tidak dapat menyelesaikan task: ${error.message}`, 'error');
            return false;
        }
    }

    async completeTasks(accessToken, axios) {
        const resourceIds = await this.getTaskList(accessToken, axios);
        if (!resourceIds || resourceIds.length === 0) {
            this.log("No uncompleted tasks found", 'info');
            return;
        }

        for (const resourceId of resourceIds) {
            if (resourceId !== 2058) {
                const success = await this.completeTask(accessToken, resourceId, axios);
                if (success) {
                    this.log(`Task selesai: ${resourceId}`, 'success');
                } else {
                    this.log(`Tidak dapat menyelesaikan task: ${resourceId}`, 'warning');
                }
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        }
    }

    async playGameIfTicketsAvailable() {
        try {
            await this.checkProxyIP();
        } catch (error) {
            this.log(`Tidak dapat memeriksa IP proxy: ${error.message}`, 'error');
            return;
        }

        const axiosInstance = this.createAxiosInstance();
        const result = await this.callBinanceAPI(this.queryString, axiosInstance);
        if (!result) return;

        const { userInfo, accessToken } = result;
        const totalGrade = userInfo.metaInfo.totalGrade;
        let availableTickets = userInfo.metaInfo.totalAttempts - userInfo.metaInfo.consumedAttempts;

        this.log(`Total poin: ${totalGrade}`);
        this.log(`Tiket tersedia: ${availableTickets}`);
        await this.completeTasks(accessToken, axiosInstance)
        while (availableTickets > 0) {
            this.log(`Mulai permainan dengan ${availableTickets} Tiket tersedia`, 'info');
            
            if (await this.startGame(accessToken, axiosInstance)) {
                if (await this.gameData()) {
                    await new Promise(resolve => setTimeout(resolve, 50000));
                    
                    if (await this.completeGame(accessToken, axiosInstance)) {
                        availableTickets--;
                        this.log(`Tiket yang tersisa: ${availableTickets}`, 'info');
                        
                        await new Promise(resolve => setTimeout(resolve, 3000));
                    } else {
                        break;
                    }
                } else {
                    this.log("Tidak dapat menerima data permainan", 'error');
                    break;
                }
            } else {
                this.log("Tidak dapat memulai permainan", 'error');
                break;
            }
        }

        if (availableTickets === 0) {
            this.log("Tiket habis boskuh", 'success');
        }
    }
}

if (isMainThread) {
    const dataFile = path.join(__dirname, 'data.txt');
    const proxyFile = path.join(__dirname, 'proxy.txt');

    const data = fs.readFileSync(dataFile, 'utf8')
        .replace(/\r/g, '')
        .split('\n')
        .filter(Boolean);

    const proxies = fs.readFileSync(proxyFile, 'utf8')
        .split('\n')
        .filter(Boolean);

    const maxThreads = 10; //nomor urutan
    const timeout = 10 * 60 * 1000;
    const waitTime = 60 * 60 * 1000; //1 jam

    async function runWorkers() {
        while (true) {
            console.log(`Kalo takut ke banned, main script pow aja :)...`.yellow);
            
            for (let i = 0; i < data.length; i += maxThreads) {
                const workerPromises = [];

                for (let j = 0; j < maxThreads && i + j < data.length; j++) {
                    const accountIndex = i + j;
                    const queryString = data[accountIndex];
                    const proxy = proxies[accountIndex % proxies.length];

                    const worker = new Worker(__filename, {
                        workerData: { accountIndex, queryString, proxy }
                    });

                    const workerPromise = new Promise((resolve, reject) => {
                        worker.on('message', resolve);
                        worker.on('error', reject);
                        worker.on('exit', (code) => {
                            if (code !== 0) reject(new Error(`Berhebti dengan kode ${code}`));
                        });

                        setTimeout(() => {
                            worker.terminate();
                            reject(new Error('Worker timed out'));
                        }, timeout);
                    });

                    workerPromises.push(workerPromise);
                }

                await Promise.allSettled(workerPromises);
                await new Promise(resolve => setTimeout(resolve, 3 * 1000));
            }

            console.log(`Semua akun diproses. Tunggu bentar ${waitTime / 60000} menit sebelum dimulai lagi...`);
            await new Promise(resolve => setTimeout(resolve, waitTime));
        }
    }

    runWorkers().catch(console.error);
} else {
    const { accountIndex, queryString, proxy } = workerData;
    const client = new Binance(accountIndex, queryString, proxy);
    client.playGameIfTicketsAvailable().then(() => {
        parentPort.postMessage('done');
    }).catch(error => {
        console.error(`Worker error: ${error.message}`);
        parentPort.postMessage('error');
    });
}
