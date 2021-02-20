const nodemailer = require("nodemailer");
const transporter = nodemailer.createTransport({
    host: "smtp.qq.com",
    port: 465,
    secure: true,
    auth: {
        user: '',
        pass: '',
    },
});
module.exports = async function (itemName, expireTime) {
    let info = await transporter.sendMail({
        from: '',
        to: "",
        subject: "小米商品下单成功",
        html: `<p>您的<span style="color: #67C23A;"> ${itemName} </span>下单成功！请在<span style="color: #E6A23C;"> ${expireTime}</span>内进行支付！</p>`
    });
}