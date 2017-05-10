const fs = require('fs');
const path = require('path');
const request = require('request');
const cheerio = require('cheerio');
//异步队列，用于逃离回调地狱
// const Aq = require('./async-queue/async-queue.js');
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
        this.pinyinQueryConfig = {};
        this.pinyinQueryConfig.tick = config.tick || config.pinyinQueryConfig.tick;
        this.pinyinQueryConfig.numEveryTime = config.numEveryTime || config.pinyinQueryConfig.numEveryTime;
        this.pinyinQueryConfig.rest = config.rest || config.pinyinQueryConfig.rest;

        //数据存储目录
        const dataPath = path.join(__dirname, '../data');
        //更新日志目录
        this.comparePath = path.join(dataPath, './compare');
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
        //测试数据存放
        this.cleanFilesArrTest = [
            path.join(dataPath, './data-clean/test/stock.json'),
            path.join(dataPath, './data-clean/test/fund.json'),
            path.join(dataPath, './data-clean/test/bond.json')
        ];
        //临时数据存放
        this.cleanFilesArrTemp = [
            path.join(dataPath, './data-clean/temp/stock.json'),
            path.join(dataPath, './data-clean/temp/fund.json'),
            path.join(dataPath, './data-clean/temp/bond.json')
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

        //对比日志目录 每次compare 都会改变这个日志记录
        this.compareLogPath = null;
        //日志文件，用来实现断点续传
        this.logFile = path.join(dataPath, './log/log.log');
    }
    //抓取文件
    static getFile(url, file, fn) {
        //抓取单个文件 异步任务 必须要有回调函数
        request(url, (err, response, body) => {
            if (err) {
                console.log(err);
            } else {
                fs.writeFileSync(file, body);
                // console.log('文件已抓取，保存成功');
                fn && fn();
            }
        });
    }
    //清洗文件
    static cleanFile(rawFile, cleanFile, callback) {
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
    }
    //抓取单个拼音
    static queryPinyin(queryUrl, key, callback) {
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
    }
    //抓取一个文件里的所有拼音
    static getPinyinFile(config, queryUrl, cleanFile, pinyinFile, logFile, callback) {

        //配置异步队列
        const aq = Aq({
            tick: config.tick,
            numEveryTime: config.numEveryTime,
            rest: config.rest,
            finalFn: () => {
                console.log('这个文件的所有拼音抓取完成...\r\n');
                callback && callback();
            }
        });
        //异步任务序列化
        const queryPinyinSerial = aq.serialize(CninfoSpider.queryPinyin);

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
                fs.appendFileSync(pinyinFile, JSON.stringify(item) + ',');
                console.log('这个文件的拼音抓取已经完成: ' + progress + '/' + totalNum);

            });

        });

    }
    //简化一个文件的数据
    static simplefyFile(srcFile, simpleFile, callback) {
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

    }
    //得到201610201850这样的字符串
    static getDate() {
        //得到201610201850这样的字符串
        const date = new Date();
        const year = date.getFullYear();
        let month = (date.getMonth() + 1);
        month = month > 9 ? month : '0' + month;
        let day = date.getDate();
        day = day > 9 ? day : '0' + day;
        let hour = date.getHours();
        hour = hour > 9 ? hour : '0' + hour;
        let minute = date.getMinutes();
        minute = minute > 9 ? minute : '0' + minute;
        let second = date.getSeconds();
        second = second > 9 ? second : '0' + second;
        const timeSnap = '' + year + month + day + hour + minute + second;
        return timeSnap;
    }
    //删除非空文件夹
    static rmdirsSync(targetPath) {
        try {
            let files = [];
            if (fs.existsSync(targetPath)) {
                files = fs.readdirSync(targetPath);
                files.forEach((file, index) => {
                    let curPath = targetPath + "/" + file;
                    if (fs.statSync(curPath).isDirectory()) { // recurse
                        if (!CninfoSpider.rmdirsSync(curPath)) return false;
                    } else { // delete file
                        fs.unlinkSync(curPath);
                    }
                });
                fs.rmdirSync(targetPath);
            }
        } catch (e) {
            console.error("remove director fail! path=" + targetPath + " errorMsg:" + e);
            return false;
        }
        return true;
    }
    //比较两个clean文件的不同
    static compareFile(firstFile, secondFile, queryPinyinUrl, logPath, callback) {
        const firstContent = JSON.parse(fs.readFileSync(firstFile, 'utf8'));
        const secondContent = JSON.parse(fs.readFileSync(secondFile, 'utf8'));
        //将所有数据放到数组里
        let arr1 = [],
            arr2 = [];
        firstContent.forEach((v, k) => {
            v.data.forEach((iv, ik) => {
                iv.parentId = v.id;
                iv.parentName = v.name;
                if (ik === 0) {
                    iv.prevCode = null;
                } else {
                    iv.prevCode = v.data[ik - 1].code;
                }
            });
            arr1.push(...v.data);
        });
        secondContent.forEach((v, k) => {
            v.data.forEach((iv, ik) => {
                iv.parentId = v.id;
                iv.parentName = v.name;
                if (ik === 0) {
                    iv.prevCode = null;
                } else {
                    iv.prevCode = v.data[ik - 1].code;
                }
            });
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

        // const compJson = JSON.stringify({
        //     "A-B": arr1_2,
        //     "B-A": arr2_1
        // });

        // fs.writeFileSync(logPath, compJson);
        // console.log(`比较完成，比较结果存放在:\r\n${logPath}\r\n文件中`);
        // callback && callback();

        //arr2_1查询拼音
        const aq = Aq({
            tick: 50,
            numEveryTime: 100,
            rest: 1000,
            finalFn: () => {
                console.log('这个文件的所有拼音抓取完成...\r\n');
                const compJson = JSON.stringify({
                    "A-B": arr1_2,
                    "B-A": arr2_1
                });

                fs.writeFileSync(logPath, compJson);
                console.log(`比较完成，比较结果存放在:\r\n${logPath}\r\n文件中`);
                callback && callback();
            }
        });
        const queryPinyinSerial = aq.serialize(CninfoSpider.queryPinyin);

        const total = arr2_1.length;
        let progress = 0;
        arr2_1.forEach((v, i) => {
            queryPinyinSerial(queryPinyinUrl, v.code, (data) => {
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
                v.orgId = data[selkey].orgId;
                v.pinyin = data[selkey].pinyin;
                progress++;
                console.log('这个文件的拼音抓取已经完成: ' + progress + '/' + total);
            });
        });
    }
    //更新clean文件
    static updateCleanFile(srcFile, patchFile, callback) {
        const srcData = JSON.parse(fs.readFileSync(srcFile, 'utf8'));
        const patchData = JSON.parse(fs.readFileSync(patchFile, 'utf8'));
        //先处理补丁数据
        let patchArr = patchData['B-A'];

        //修改  000001 平安银行    000001 中国银行
        //数组一边遍历一边删除，需要倒着循环        
        for (let i = patchArr.length - 1; i >= 0; i--) {
            srcData[patchArr[i].parentId - 1].data.some((iv, ik) => {
                if (patchArr[i].code === iv.code) {
                    iv.name = patchArr[i].name;
                    patchArr.splice(i, 1); //遍历中删除  是否有问题？？？
                    return true;
                }
            });
        }

        //添加
        let repairArr = [];
        //遍历补丁 数据分组 预处理
        patchArr.forEach((item, index) => {
            if (index === 0) {
                repairArr.push([item]);
            } else {
                if (item.prevCode === patchArr[index - 1].code && item.parentId === patchArr[index - 1].parentId) {
                    repairArr[repairArr.length - 1].push(item);
                } else {
                    repairArr.push([item]);
                }
            }
        });
        // console.log(repairArr);
        repairArr.forEach((v, k) => {
            let position = 0;
            srcData[v[0].parentId - 1].data.some((iv, ik) => {
                if (iv.code === v[0].prevCode) {
                    position = ik + 1;
                    return true;
                }
            });
            let varr = [];
            v.forEach((jv, jk) => {
                varr.push({
                    code: jv.code,
                    name: jv.name
                });
            });
            srcData[v[0].parentId - 1].data.splice(position, 0, ...varr);
        });

        // console.log(srcData);
        const jsonSrcData = JSON.stringify(srcData);
        fs.writeFileSync(srcFile, jsonSrcData, 'utf8');
        callback && callback();
    }
    static updatePinyinFile(srcFile, patchFile, callback) {
        const srcData = JSON.parse(fs.readFileSync(srcFile, 'utf8'));
        const patchData = JSON.parse(fs.readFileSync(patchFile, 'utf8'));
        //先处理补丁数据
        let patchArr = patchData['B-A'];

        //修改  000001 平安银行    000001 中国银行
        //数组一边遍历一边删除，需要倒着循环        
        for (let i = patchArr.length - 1; i >= 0; i--) {
            srcData.some((iv, ik) => {
                if (patchArr[i].code === iv[1]) {
                    iv[2] = patchArr[i].name;
                    iv[3] = patchArr[i].pinyin;
                    patchArr.splice(i, 1); //遍历中删除  是否有问题？？？
                    return true;
                }
            });
        }

        //添加
        let repairArr = [];
        //遍历补丁 数据分组 预处理
        patchArr.forEach((item, index) => {
            if (index === 0) {
                repairArr.push([item]);
            } else {
                if (item.prevCode === patchArr[index - 1].code && item.parentId === patchArr[index - 1].parentId) {
                    repairArr[repairArr.length - 1].push(item);
                } else {
                    repairArr.push([item]);
                }
            }
        });
        // console.log(repairArr);
        repairArr.forEach((v, k) => {
            let position = 0;
            srcData.some((iv, ik) => {
                if (iv[1] === v[0].prevCode) {
                    position = ik + 1;
                    return true;
                }
            });
            let varr = [];
            v.forEach((jv, jk) => {
                varr.push([
                    jv.orgId,
                    jv.code,
                    jv.name,
                    jv.pinyin
                ]);
            });
            srcData.splice(position, 0, ...varr);
        });

        // console.log(srcData);
        const jsonSrcData = JSON.stringify(srcData);
        fs.writeFileSync(srcFile, jsonSrcData, 'utf8');
        callback && callback();
    }
    //抓取三个文件
    getContent(callback) {
        //配置异步队列
        const aq = Aq({
            finalFn: () => {
                console.log('原始文件抓取完成...\r\n');
                callback && callback();
            }
        });
        //异步任务序列化
        const getSingleFileSerial = aq.serialize(CninfoSpider.getFile);

        //异步队列依次执行 依次抓取数据
        [this.stockUrl, this.fundUrl, this.bondUrl].forEach((v, k) => {
            getSingleFileSerial(v, this.rawFilesArr[k], () => {
                console.log('已完成对' + v + '的抓取');
            });
        });
    }
    //清洗三个文件
    cleanData(callback) {
        //配置异步队列
        const aq = Aq({
            finalFn: () => {
                console.log('文件清洗完成...\r\n');
                callback && callback();
            }
        });
        //异步任务序列化
        const cleanSingleFileSerial = aq.serialize(CninfoSpider.cleanFile);
        //执行异步队列
        this.rawFilesArr.forEach((v, k) => {
            cleanSingleFileSerial(v, this.cleanFilesArrTemp[k]);
        });
    }
    //抓取所有文件的拼音
    getPinyin(callback) {
        //配置异步队列
        const aq = Aq({
            finalFn: () => {
                console.log('拼音抓取全部完成...\r\n')
                callback && callback();
            }
        });
        //序列化
        const getSimpleFilePinyinSerial = aq.serialize(CninfoSpider.getPinyinFile);

        //顺序执行
        this.cleanFilesArr.forEach((v, k) => {
            getSimpleFilePinyinSerial(this.pinyinQueryConfig, this.pinyinQueryUrl, v, this.pinyinFilesArr[k], this.logFile, () => {

                let content = fs.readFileSync(this.pinyinFilesArr[k], 'utf8');
                content = content.slice(0, -1);
                content = '[' + content + ']';
                fs.writeFileSync(this.pinyinFilesArr[k], content);
                console.log('第' + (k + 1) + '个文件的拼音获取完成\r\n');
            });
        });
    }
    //所有的数据轻量化
    simplefy(callback) {
        //配置异步队列
        const aq = Aq({
            finalFn: () => {
                console.log('数据轻量化完成...\r\n');
                callback && callback();
            }
        });
        //异步任务序列化
        const singleFileSimplefySerial = aq.serialize(CninfoSpider.simplefyFile);

        this.pinyinFilesArr.forEach((v, k) => {
            singleFileSimplefySerial(v, this.simpleFilesArr[k], () => {
                console.log(`第${k+1}个文件简化成功\r\n`);
            });
        });
    }
    //比较所有的文件 记录比较日志
    compare(callback) {
        //先创建日期文件夹
        const compareLogPath = path.join(this.comparePath, `./compareLog-${CninfoSpider.getDate()}`);

        if (fs.existsSync(compareLogPath)) {
            CninfoSpider.rmdirsSync(compareLogPath);
        }
        fs.mkdirSync(compareLogPath);
        this.compareLogPath = compareLogPath;
        //配置异步队列
        const aq = Aq({
            finalFn: () => {
                console.log('对比完成...\r\n');
                callback && callback();
            }
        });
        //异步任务序列化
        const compareFileSerial = aq.serialize(CninfoSpider.compareFile);
        //执行异步队列
        this.cleanFilesArr.forEach((v, k) => {
            const logFile = path.join(compareLogPath, './log-' + ['stock', 'fund', 'bond'][k] + '.json');
            compareFileSerial(v, this.cleanFilesArrTemp[k], this.pinyinQueryUrl, logFile);
        });

    }
    //更新文件clean文件 拼音文件
    update(callback) {
        const aq = Aq({
            finalFn: () => {
                console.log('更新完成...\r\n');
                callback && callback();
            }
        });
        const updateCleanFileSerial = aq.serialize(CninfoSpider.updateCleanFile);
        const updatePinyinFileSerial = aq.serialize(CninfoSpider.updatePinyinFile);
        this.cleanFilesArr.forEach((v, k) => {
            const logFile = path.join(this.compareLogPath, './log-' + ['stock', 'fund', 'bond'][k] + '.json');
            updateCleanFileSerial(v, logFile, () => {
                console.log(`第${k+1}个clean文件更新成功\r\n`);
            });
        });
        this.pinyinFilesArr.forEach((v, k) => {
            const logFile = path.join(this.compareLogPath, './log-' + ['stock', 'fund', 'bond'][k] + '.json');
            updatePinyinFileSerial(v, logFile, () => {
                console.log(`第${k+1}个pinyin文件更新成功\r\n`);
            });
        });
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
        //配置异步队列
        const aq = Aq({
            finalFn: () => {
                console.log('全部工作完成！\r\n')
                callback && callback();
            }
        });
        //异步任务序列化
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
    repair(callback) {
        //使用AsyncQueue避免回调地狱
        //配置异步队列
        const aq = Aq({
            finalFn: () => {
                console.log('全部工作完成！\r\n')
                callback && callback();
            }
        });
        //异步任务序列化
        //序列化的函数需要有callback
        const getContentSerial = aq.serialize((callback) => {
            this.getContent(callback);
        });
        const cleanDataSerial = aq.serialize((callback) => {
            this.cleanData(callback);
        });

        const compareSerial = aq.serialize((callback)=>{
            this.compare(callback);
        });

        const updateSerial = aq.serialize((callback)=>{
            this.update(callback);
        });

        const simplefySerial = aq.serialize((callback) => {
            this.simplefy(callback);
        });

        getContentSerial();
        cleanDataSerial();
        compareSerial();
        updateSerial();
        simplefySerial();
        compareSerial();//最后再对比一次
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

//5.数据更新
//拿到最新的clean数据B，与上一次的clean数据A进行比较, 得到B-A文件
//将B-A 添加到A的合适位置, 删除B
//将B-A 文件查询拼音 得到拼音文件B-A-pinyin
//将拼音文件B-A-pinyin 添加到A拼音文件的合适位置
//重新轻量化数据

//比较文件的差异
//断点续传

module.exports = CninfoSpider;