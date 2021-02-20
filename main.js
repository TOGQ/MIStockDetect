const puppeteer = require('puppeteer-core');
const config = require('./config');
const core = require('./core');

(async function () {
    puppeteer.launch({
        headless: true,
        defaultViewport: null,
        args: ['--start-maximized'],
        ignoreDefaultArgs: ['--enable-automation'],
        executablePath: config.chromeExePath,
    }).then(async browser => {
        const page = await browser.newPage();
        run(browser, page);
    })
}())

async function run(browser, page) {

    core.setConfig(config);

    if (config.startTime) {
        let timeDiff = new Date(config.startTime) - new Date();
        core.countDown(config.startTime);
        setTimeout(() => {
            core.start(browser, page);
        }, timeDiff > 0 ? timeDiff - 12500 : 0);//登录等待的8-10s左右时间加提前2.5秒开始(根据网络情况适当调整改值)
    } else {
        core.start(browser, page);
    }
}