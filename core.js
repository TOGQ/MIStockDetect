const email = require('./email');
const goodsInfo = {
    name: ""
};
var buyLock = false;
var loginLock = false;
var restryCount = 1;
var actionCount = 0;
var config;
var isItemPage = false;
var finished = false;

async function start(browser, page) {


    if (!isItemPage) {
        await preAction(page);
    }

    //立即执行一次
    await run(browser, page);

    if (finished) { return };
    const timer = setInterval(async () => {
        await run(browser, page, timer);
    }, Math.max(config.interval * 1000, 80));
}

async function login(page) {
    await goto(page, config.loginUrl, 'input[name=account]');
    await page.type('input[name=account]', config.username, { delay: 100 });
    await page.type('input[name=password]', config.password, { delay: 100 });
    await Promise.all([
        page.waitForNavigation(),
        page.click('button[type=submit]')

    ]);
}

async function preAction(page) {

    if (isItemPage || loginLock) {
        return;
    }
    //锁住登录状态（怕是调用了提前登录，还没有登录成功定时任务就到了，而此时并没有登录完成，定时任务中就会再登录）
    loginLock = true;

    if (!config) {
        throw new Error('请通过setConfig(Object)方法设置配置！');
    }

    let startTime = new Date();

    await login(page);
    await goto(page, config.itemUrl, 'a[data-href^="//order.mi.com/site/login"]');
    await page.click('a[data-href^="//order.mi.com/site/login"]');

    try {
        await page.waitForSelector('.mi-popup', { timeout: 2000 })
    } catch (e) {
        //
    }

    let agree = await page.$('.el-dialog__footer .btn-primary');
    if (agree) {
        await agree.click();
        await page.waitForResponse(res => res.url().startsWith('https://api2.order.mi.com/product/delivery') && res.status() == 200);
    }

    console.log('请等待...');

    //选择选项,如果采用有库存的时候才选择选项来刷新按钮（可能会和默认的选项一致，那么就不会达到刷新按钮的目的）
    await optionSelect(page, config.options, config.batchIndex);

    console.log('从登录到商品页面总计耗时：', new Date().getTime() - startTime);

    isItemPage = true;
}

async function optionSelect(page, userOptions, batchIndex) {
    goodsInfo.optionInfo = await page.$$eval('.option-box', (options, userOptions) => {
        let optionInfo = { index: null, value: null, size: options.length, currentOptions: [] };
        for (let i = 0; i < options.length; i++) {

            let subOps = options[i].querySelectorAll('li');
            //获取选择大于1的，用于刷新按钮
            if (!optionInfo.index && subOps.length > 1) {
                optionInfo.index = i
                optionInfo.value = (userOptions[i] < subOps.length ? userOptions[i] + 1 : userOptions[i] - 1)
            };

            //获取当前选项
            for (let j = 0; j < subOps.length; j++) {
                if (Array.from(subOps[j].classList).includes('active')) {
                    optionInfo.currentOptions.push(j);
                }
            }
        }
        return optionInfo;
    }, userOptions)

    //选择参数
    // console.log('当前选项：' + goodsInfo.optionInfo.currentOptions);
    // console.log('用户选项：' + userOptions);
    for (let i = 0; i < goodsInfo.optionInfo.size; i++) {
        //判断是否和默认相同，相同则无需选择
        if (goodsInfo.optionInfo.currentOptions[i] != undefined && goodsInfo.optionInfo.currentOptions[i] == userOptions[i] - 1) {
            // console.log('跳过');
            continue;
        }
        await page.click(`.buy-option>.buy-box-child:nth-child(${i + 1}) li:nth-child(${userOptions[i]})`)
        //点击后的等待数据请求后
        await page.waitForResponse(res => res.url().startsWith('https://api2.order.mi.com/product/delivery') && res.status() == 200);
    }

    //选择套餐
    if (batchIndex) {
        try {
            //修改错误：nth-child下标从1开始
            await page.click(`.batch-box li:nth-child(${batchIndex})`);
        } catch (e) {
            console.log('没有套餐可以选择！');
        }
    }
}

async function goto(page, url, waitForSelector) {
    await page.goto(url);
    await page.waitForSelector(waitForSelector);
};

async function refreshBtn(page, optionInfo, userOptions, batchIndex) {
    if (!optionInfo.index) {
        //说明所有都是一个选项，只能刷新页面
        await page.reload();
    } else {
        //点击别的
        await page.$$eval('.option-box', (options, optionInfo) => {
            options[optionInfo.index].querySelectorAll('li')[optionInfo.value - 1].click();
        }, optionInfo);

        await page.waitForResponse(response => response.url().startsWith('https://api2.order.mi.com/product/delivery') && response.status() === 200);
        //点击回来
        await optionSelect(page, userOptions, batchIndex);
    }
    await page.waitForSelector('.sale-btn a');
}

async function buy(page) {
    //加入购物车
    await Promise.all([
        page.waitForNavigation({ timeout: 2000 }),
        page.click('.sale-btn a')
    ]);
    console.log('加入购物车成功！');

    // throw new Error('测试出错');
    //获取商品名
    goodsInfo.name = await page.$eval('.goods-info>.name', el => el.innerText);

    //去购物车结算
    await Promise.all([
        page.waitForNavigation(),
        page.click('.actions>.btn-primary')
    ]);
    console.log('去购物车结算！');

    //去结算，会把全部结算，最好购物车只有一件商品

    //删除类名，不删除无头模式找不到元素
    await page.$eval('.cart-bar', el => el.classList.remove('cart-bar-fixed'));
    await Promise.all([
        page.waitForNavigation(),
        page.click('.cart-bar .btn-primary')
    ]);
    console.log('去结算！');

    //选择收货地址（第一个）
    await page.click('.address-item');

    //点击下单
    await Promise.all([
        page.waitForNavigation(),
        page.click('.operating-button>.btn-primary')
    ]);
    let pay_time = await page.$eval('.pay-time-tip', el => el.textContent);
    console.log("下单成功！请在" + pay_time + "内手动支付!");

    finished = true;
    //发送邮件
    email(goodsInfo.name, pay_time).catch(console.error);
}

async function canBuy(page) {
    return page.evaluate((goodsId, api) => {
        return new Promise((resolve, reject) => {
            fetch(api)
                .then(res => res.json()).then(json => {
                    resolve(json.data.first_datas[goodsId].stock_num > 0);
                }).catch(() => reject())
        })
    }, config.goodsId, config.itemQueryApiPre + config.goodsId + config.itemQueryApiParam + Math.round(new Date() / 1000));
}

function countDown(startTime) {
    const dayms = 1000 * 60 * 60 * 24;
    const hms = 1000 * 60 * 60;
    const mms = 1000 * 60;
    const startDate = new Date(startTime);
    const action = setInterval(() => {
        let timeDiff = startDate - new Date();
        if (timeDiff <= 0) {
            clearInterval(action);
            return;
        }
        console.clear();
        let day = Math.floor(timeDiff / dayms)
        let hour = Math.floor(timeDiff % dayms / hms)
        let minu = Math.floor(timeDiff % dayms % hms / mms)
        let secon = Math.floor(timeDiff % dayms % hms % mms / 1000)
        console.log('距离：' + startTime.replace('T', ' ') + ' 还有：' + day + '天' + hour + '小时' + minu + '分钟' + secon + '秒')
    }, 1000)
}

async function run(browser, page, timer) {
    //正在下单，或者还没有登录成功（例如到了定时时间，登录还在进行，出现此情况就是，使用提前登录而定时的时候很快就要到了）
    if (buyLock || !isItemPage) { return; }
    if (restryCount > 5) {
        await stop(timer, browser);
        return;
    }
    try {
        if (await canBuy(page)) {
            buyLock = true;
            if (actionCount > 1) {
                //刷新按钮
                await refreshBtn(page, goodsInfo.optionInfo, config.options, config.batchIndex);
                //等待500毫秒，实际开始时间会晚个1-2秒
                await page.waitFor(500);
            }
            // clearInterval(timer);
            // return;
            await buy(page);
            await stop(timer, browser);
        } else {
            console.error(new Date().toLocaleString(), " 无货状态！");
        }
    } catch (error) {
        console.log("第" + restryCount + "次重试！");
        buyLock = false;
        restryCount++;
        await goto(page, config.itemUrl, '.option-box li');
        await optionSelect(page, config.options, config.batchIndex);
        console.log(error);
    } finally {
        actionCount++;
    }
}

async function stop(timer, browser) {
    timer && clearInterval(timer);
    await browser.close();
}

function setConfig(conf) {
    config = conf;
}

exports.start = start;
exports.setConfig = setConfig;
exports.countDown = countDown;
exports.preAction = preAction;