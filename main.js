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

        core.countDown(config.startTime);

        let timeDiff = new Date(config.startTime) - new Date();
        let preActionTime = 8000;

        //登录等待的6-8s左右时间加提前1秒开始(根据网络情况适当调整改值)
        // let awaitStartTime = timeDiff - preActionTime - 1000;
        let awaitStartTime = timeDiff - 1000;

        setTimeout(() => {
            core.start(browser, page);
        }, awaitStartTime > 0 ? awaitStartTime : 0);

        //提前登录，那么就不需要再减去preActionTime;
        await core.preAction(page);
        
    } else {
        core.start(browser, page);
    }
}
