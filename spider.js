const fs = require('fs');
const path = require('path');
const request = require('request');
const cheerio = require('cheerio');

class Spider {
    //构造函数
    constructor(url, rawFilePath, cleanFilePath) {
        //url
        this.url = url;
        //抓取到的文件的保存路径
        this.rawFilePath = rawFilePath || path.join(__dirname, './data-pool/test.html');
        //解析后的文件的保存路径
        this.cleanFilePath = cleanFilePath || path.join(__dirname, './data-clean/test.json');
    }
    //获取文件
    getContent(callback) {
        //文件保存路径
        request(this.url, (error, response, body) => {
            if (error) {
                console.log(error);
            } else {
                fs.writeFile(this.rawFilePath, body, (err) => {
                    if (err) {
                        console.log(err);
                    } else {
                        console.log('获取完成并保存成功！');
                        callback && callback();
                    }
                });
            }

        });
    }
    //解析文件
    execContent() {
        //读取文件
        fs.readFile(this.rawFilePath, 'utf8', (err, data) => {
            if (err) {
                console.log(err);
            } else {
                //加载文件 不要解码 否则汉字会显示为编码
                const $ = cheerio.load(data, {
                    decodeEntities: false
                });

                //一个数据映射
                //const categoryMap = ['深市主板', '中小企业板', '创业板', '沪市主板', '香港主板', '香港创业板'];
                const categoryMap = [];
                $('.list-header ul li a').each((i,v)=>{
                    categoryMap.push($(v).text());
                })

                //存放所有的股票数据
                let finalData = [];
                $('.list-ct>div').each((k, v) => {
                    let category = {};
                    category.id = k + 1;
                    category.name = categoryMap[k];
                    category.data = [];

                    $(`.list-ct #con-a-${k+1} ul li a`).each((innerk, innerv) => {
                        //将 '000001 平安银行' 封装成 {stockCode:'000001',stockName:'平安银行'}
                        let obj = {};

                        // obj.code = $(innerv).text().split(' ')[0];
                        // // 特 力A 不能使用split(' ')[1]
                        // // A股6位代码从7截取 港股5位代码从6截取
                        // // 债 Q16050503 16国美03 
                        // obj.name = $(innerv).text().slice(categoryMap[k].startsWith('香港') ? 6 : 7);
                        // //追加到数组

                        const strToArr = $(innerv).text().split(' ');
                        obj.code = strToArr[0];
                        strToArr.shift();
                        obj.name = strToArr.join(' ');

                        category.data.push(obj);
                    });
                    finalData.push(category);
                });

                //将数据转成json数据
                const jsonData = JSON.stringify(finalData);
                //保存json数据
                fs.writeFile(this.cleanFilePath, jsonData, (err) => {
                    if (err) {
                        console.log(err);
                    } else {
                        console.log('解析完成并保存成功！');
                    }
                });
            }

        });


    }
    //统一的执行接口
    run(){
        this.getContent(()=>{
            this.execContent();
        });
    }
}

module.exports = Spider;