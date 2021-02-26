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

        //登录等待的6-8s左右时间(根据网络情况适当调整改值)
        // let awaitStartTime = timeDiff - preActionTime;

        // 不要提前，按钮好像有等待时间（应该推迟到500ｍｓ左右，待测试）
        let awaitStartTime = timeDiff;

        setTimeout(async () => {
            await core.start(browser, page);
        }, awaitStartTime > 0 ? awaitStartTime : 0);

        /**
         * 提前登录，那么就不需要再减去preActionTime;
         * 提前登录的情况是在开始下单前几小时运行该程序就登录为下单节约出更多的时间
         * 不提前登录是距离开始下单还有很久的时间，如果提前登录长时间闲置可能会使登录失效，所有在下单前再登录
         */
        await core.preAction(page);

    } else {
        core.start(browser, page);
    }
}