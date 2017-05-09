const fs = require('fs');
const path = require('path');
const request = require('request');
const cheerio = require('cheerio');

const Aq = require('./async-queue/async-queue.js');

class CninfoSpider {
    //传入一个配置对象 config 应该包括3个url和1个拼音接口
    constructor(config) {
        //四个接口
        this.stockUrl = config.stockUrl;
        this.fundUrl = config.fundUrl;
        this.bondUrl = config.bondUrl;
        this.pinyinQueryUrl = config.pinyinQueryUrl;
        //对于抓取拼音这种大量IO工作需要设置一些参数
        this.tick = config.tick;
        this.numEveryTime = config.numEveryTime;
        this.rest = config.rest;

        //数据存储目录
        const dataPath = path.join(__dirname, '../data');
        //原始数据存放
        this.rawFilesArr = [
            path.join(dataPath, './data-pool/stock.html'),
            path.join(dataPath, './data-pool/fund.html'),
            path.join(dataPath, './data-pool/bond.html')
        ];
        //清洗干净数据存放
        this.cleanFilesArr = [
            path.join(dataPath, './data-clean/stock.json'),
            path.join(dataPath, './data-clean/fund.json'),
            path.join(dataPath, './data-clean/bond.json')
        ];
        //带拼音数据存放
        this.pinyinFilesArr = [
            path.join(dataPath, './data-pinyin/stock-pinyin.json'),
            path.join(dataPath, './data-pinyin/fund-pinyin.json'),
            path.join(dataPath, './data-pinyin/bond-pinyin.json')
        ];
        //简化数据存放
        this.simpleFilesArr = [
            path.join(dataPath, './data-simple/stock-pinyin-simple.json'),
            path.join(dataPath, './data-simple/fund-pinyin-simple.json'),
            path.join(dataPath, './data-simple/bond-pinyin-simple.json')
        ];
        //日志文件，用来实现断点续传
        this.logFile = path.join(dataPath, './log/log.log');
    }
    //抓取文件
    getContent(callback) {
        //抓取单个文件 异步任务 必须要有回调函数
        const getSingleFile = (url, file, fn) => {
            request(url, (err, response, body) => {
                if (err) {
                    console.log(err);
                } else {
                    fs.writeFileSync(file, body);
                    // console.log('文件已抓取，保存成功');
                    fn && fn();
                }
            });
        };

        //配置异步队列
        const aq = Aq({
            finalFn: () => {
                console.log('原始文件抓取完成...\r\n');
                callback && callback();
            }
        });
        //异步任务序列化
        const getSingleFileSerial = aq.serialize(getSingleFile);

        //依次抓取数据
        [this.stockUrl, this.fundUrl, this.bondUrl].forEach((v, k) => {
            getSingleFileSerial(v, this.rawFilesArr[k], () => {
                console.log('已完成对' + v + '的抓取');
            });
        });
    }
    //清洗文件
    cleanData(callback) {
        //一个异步任务
        const cleanSingleFile = (rawFile, cleanFile, callback) => {
            //读取原始文件
            const content = fs.readFileSync(rawFile, 'utf8');
            //加载文件 不要解码 否则汉字会显示为编码
            const $ = cheerio.load(content, {
                decodeEntities: false
            });

            //一个数据映射
            //const categoryMap = ['深市主板', '中小企业板', '创业板', '沪市主板', '香港主板', '香港创业板'];
            const categoryMap = [];
            $('.list-header ul li a').each((i, v) => {
                categoryMap.push($(v).text());
            });

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
            fs.writeFileSync(cleanFile, jsonData);
            console.log('已经完成对' + rawFile + '文件的清洗，并保存在' + cleanFile);
            callback && callback();
        };
        //配置异步队列
        const aq = Aq({
            finalFn: () => {
                console.log('文件清洗完成...\r\n');
                callback && callback();
            }
        });
        //异步任务序列化
        const cleanSingleFileSerial = aq.serialize(cleanSingleFile);
        //执行异步队列
        this.rawFilesArr.forEach((v, k) => {
            cleanSingleFileSerial(v, this.cleanFilesArr[k]);
        });
    }
    //抓取拼音
    getPinyin(callback) {
        //对单个文件里的所有项目抓取拼音
        const getSimpleFilePinyin = (queryUrl, cleanFile, pinyinFile, logFile, callback) => {
            //异步任务
            const queryPinyin = (queryUrl, key, callback) => {
                request.post({
                    url: queryUrl,
                    form: {
                        keyWord: key,
                        maxNum: 10
                    }
                }, (err, response, body) => {
                    if (err) {
                        console.log(err);
                    } else {
                        callback && callback(body);
                    }
                });
            };
            //配置异步队列
            const aq = Aq({
                tick: this.tick,
                numEveryTime: this.numEveryTime,
                rest: this.rest,
                finalFn: () => {
                    console.log('异步队列完成');
                    callback && callback();
                }
            });
            //异步任务序列化
            const queryPinyinSerial = aq.serialize(queryPinyin);

            //读取文件
            const content = fs.readFileSync(cleanFile, 'utf8');
            //json化数据
            const cleanData = JSON.parse(content);
            // 股票总数
            let totalNum = 0;
            //所有的股票都存在这里
            let arr = [];
            cleanData.forEach((v, k) => {
                v.data.forEach((iv, ik) => {
                    arr.push(iv);
                });
            });
            totalNum = arr.length;

            //先读取日志 实现断点续传
            const log = fs.readFileSync(logFile, 'utf8');
            let start = 0;
            if (log) {
                start = content.split(' ')[1].split('/')[0];
            }
            //断点续传
            for (let i = 0; i < start; i++) {
                arr.shift();
            }

            //统计已经拿到了多少个
            let progress = start;
            arr.forEach((v, k) => {
                //为了轻量化 使用数组 0->id 1->code 2->name 3->pinyin 
                let item = [];
                queryPinyinSerial(queryUrl, v.code, (data) => {
                    data = JSON.parse(data);
                    //选中的数据项 默认第一项
                    let selkey = 0;
                    if (data.length > 1) {
                        data.some((selv, selk) => {
                            //对比拿到的数据 如果名字相同 就是同一条数据了
                            if (selv.zwjc === v.name) {
                                selkey = selk;
                                return true;
                            }
                        });
                    }

                    item[0] = data[selkey].orgId;
                    item[1] = v.code;
                    item[2] = v.name;
                    item[3] = data[selkey].pinyin;

                    progress++;
                    console.log('已经完成: ' + progress + '/' + totalNum);

                    fs.appendFileSync(pinyinFile, JSON.stringify(item) + ',');
                    console.log('拼音保存完成！');

                });

            });

        };

        //配置异步队列
        const aq = Aq({
            finalFn: () => {
                console.log('拼音抓取全部完成...\r\n')
                callback && callback();
            }
        });
        //序列化
        const getSimpleFilePinyinSerial = aq.serialize(getSimpleFilePinyin);

        //顺序执行
        this.cleanFilesArr.forEach((v, k) => {
            getSimpleFilePinyinSerial(this.pinyinQueryUrl, v, this.pinyinFilesArr[k], this.logFile, () => {

                let content = fs.readFileSync(this.pinyinFilesArr[k], 'utf8');
                content = content.slice(0, -1);
                content = '[' + content + ']';
                fs.writeFileSync(this.pinyinFilesArr[k], content);
                console.log('第' + (k + 1) + '个文件的拼音获取完成');
            });
        });
    }
    //数据轻量化
    simplefy(callback) {
        const singleFileSimplefy = (srcFile, simpleFile, callback) => {
            //读取源文件
            const srcContent = fs.readFileSync(srcFile, 'utf8');
            //json数据转化成js对象
            const srcData = JSON.parse(srcContent);

            //存储简化的字符串   [[ 'gssz0000001', '000001', '平安银行', 'payh' ],...] --->'|0000001-平安银行-payh|...'
            let simpleStr = '';
            //不要拼接字符串 使用数组优化
            let simpleArr = [];

            srcData.forEach((v, k) => {
                simpleArr.push(v[1] + '-' + v[2] + '-' + v[3]);
            });
            //数组转字符串
            simpleStr = simpleArr.join('|');

            //存储简化数据
            // fs.writeFile 硬编码 data 部分只能是 string | buffer 不能是表达式 JSON.stringify()
            const jsonData = JSON.stringify({
                data: simpleStr
            });
            fs.writeFileSync(simpleFile, jsonData);
            console.log('转换存储成功');
            callback && callback();
        };
        const aq = Aq({
            finalFn: () => {
                console.log('数据轻量化完成...\r\n');
                callback && callback();
            }
        });
        const singleFileSimplefySerial = aq.serialize(singleFileSimplefy);

        this.pinyinFilesArr.forEach((v, k) => {
            singleFileSimplefySerial(v, this.simpleFilesArr[k], () => {
                console.log(`第${k+1}个文件简化成功`);
            });
        });
    }
    //比较两个clean文件的不同
    static compareJsonFiles(firstFile, secondFile, callback) {
        const firstContent = JSON.parse(fs.readFileSync(firstFile, 'utf8'));
        const secondContent = JSON.parse(fs.readFileSync(secondFile, 'utf8'));
        //将所有数据放到数组里
        let arr1 = [],
            arr2 = [];
        firstContent.forEach((v, k) => {
            arr1.push(...v.data);
        });
        secondContent.forEach((v, k) => {
            arr2.push(...v.data);
        });

        let arr1_2 = [],
            arr2_1 = [];
        //A里面有而B里面没有  A-B的结果
        const A_B = (A, B) => {
            let arrA_B = [];
            A.forEach((v, k) => {
                let flag = false; //默认v不在arr2里面
                B.some((v2, k2) => {
                    if (v2.code === v.code && v2.name === v.name) {
                        flag = true;
                        return true;
                    }
                });
                if (!flag) {
                    arrA_B.push(v);
                }
            });
            return arrA_B;
        };
        arr1_2 = A_B(arr1, arr2);
        arr2_1 = A_B(arr2, arr1);

        const compJson = JSON.stringify({
            "A-B": arr1_2,
            "B-A": arr2_1
        });
        //添加时间信息
        const getDate = () => {
            const date = new Date();
            const year = date.getFullYear();
            const month = (date.getMonth() + 1) > 9 ? (date.getMonth() + 1) : '0' + (date.getMonth() + 1);
            const day = date.getDate() > 9 ? date.getDate() : '0' + date.getDate();
            const hour = date.getHours() > 9 ? date.getHours() : '0' + date.getHours();
            const minute = date.getMinutes() > 9 ? date.getMinutes() : '0' + date.getMinutes();
            const second = date.getSeconds() > 9 ? date.getSeconds() : '0' + date.getSeconds();
            const timeSnap = '' + year + month + day + hour + minute + second;
            return timeSnap;
        };

        const logPath = path.join(__dirname, `../data/compare/complog-${getDate()}.json`);
        fs.writeFileSync(logPath, compJson);
        console.log(`比较完成，比较结果存放在:\r\n${logPath}\r\n文件中`);
        callback && callback();
    }
    run(callback) {
        //回调地狱！！！
        // this.getContent(() => {
        //     this.cleanData(() => {
        //         this.getPinyin(() => {
        //             this.simplefy(() => {
        //                 callback && callback();
        //             });
        //         });
        //     });
        // });

        //使用AsyncQueue避免回调地狱
        const aq = Aq({
            finalFn: () => {
                console.log('全部工作完成！\r\n')
                callback && callback();
            }
        });
        //序列化的函数需要有callback
        const getContentSerial = aq.serialize((callback) => {
            this.getContent(callback);
        });
        const cleanDataSerial = aq.serialize((callback) => {
            this.cleanData(callback);
        });
        const getPinyinSerial = aq.serialize((callback) => {
            this.getPinyin(callback);
        });
        const simplefySerial = aq.serialize((callback) => {
            this.simplefy(callback);
        });

        getContentSerial();
        cleanDataSerial();
        getPinyinSerial();
        simplefySerial();
        //是不是很神奇的样子，看起来像是同步执行的！
    }
}

//1.抓取文件 request 
//  输入3个url
//  抓取3个文件
//2.清洗数据 cheerio
//  输入 抓取到的3个文件
//  输出3个清洗干净的数据文件
//3.抓取拼音 request 同步化
//  输入 3 个数据文件 + 拼音接口
//  输出3个带有拼音的数据文件
//4.数据轻量化
//  输入3个拼音文件
//  输出3个简化文件

//比较文件的差异
//断点续传

module.exports = CninfoSpider;