const fs = require('fs');
const path = require('path');
const request = require('request');
const cheerio = require('cheerio');

class PinyinSpider {
    constructor(url, cleanFilePath, pinyinFilePath, logFilePath) {
        this.url = url;
        this.cleanFilePath = cleanFilePath;
        this.pinyinFilePath = pinyinFilePath;
        this.logFilePath = logFilePath;
        this.sync = {
            timer: null,
            number: 0,
            wait: false,
            queue: []
        };
    }
    queryPinyin(key, callback) {
        request.post({
            url: this.url,
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
    queryPinyinSync(key, callback, final) {
        //将异步操作添加到队列
        this.sync.queue.push(() => {
            // 让后面的等待
            this.sync.wait = true;
            this.queryPinyin(key, (data) => {
                // console.log('ok');//没执行
                callback && callback(data);
                //执行完成后 放开限制 后面下一个可以直接执行
                this.sync.wait = false;
            });
        });
        //将整个队列的遍历执行 添加到异步异步
        // clearTimeout(this.sync.timer);
        // this.sync.timer = setTimeout(() => {
        //     //while 同步操作卡死了主线程  异步队列无法执行
        //     while (this.sync.queue.length) {
        //         if (!this.sync.wait) {
        //             this.sync.queue.shift()();
        //         }
        //     }
        // }, 0);

        clearInterval(this.sync.timer);
        this.sync.timer = setInterval(() => {
            if (this.sync.queue.length) {
                if (!this.sync.wait) {
                    //每次抓100个 然后休息 30s 
                    if (this.sync.number % 400 < 100) {
                        this.sync.queue.shift()();
                    }
                    this.sync.number++;
                }
            } else {
                if (!this.sync.wait) {
                    clearInterval(this.sync.timer);
                    // console.log('ok');
                    final && final();
                }
            }
        }, 100);

    }
    run() {
        fs.readFile(this.cleanFilePath, 'utf8', (err, data) => {
            if (err) {
                console.log(err);
            } else {
                data = JSON.parse(data);

                //先读取日志 实现断点续传
                const content = fs.readFileSync(this.logFilePath,'utf8');
                let start = 0;
                if(content){
                    start = content.split(' ')[1].split('/')[0];
                }

                // 股票总数
                let len = 0;
                //所有的股票都存在这里
                let arr = [];
                data.forEach((v, k) => {
                    v.data.forEach((iv, ik) => {
                        arr.push(iv);
                    });
                });
                len = arr.length;

                for ( let i = 0; i < start; i++){
                    arr.shift();
                }


                let progress = start; //统计已经拿到了多少个
                // let pinyinArr = [];
                arr.forEach((v, k) => {
                    //为了轻量化 使用数组 0->id 1->code 2->name 3->pinyin 
                    let item = [];
                    this.queryPinyinSync(v.code, (data) => {

                        data = JSON.parse(data);
                        let selkey = 0;
                        if(data.length > 1){
                            data.some((selv,selk)=>{
                                if(selv.zwjc===v.name){
                                    selkey = selk;
                                    return true;
                                }
                            });
                        }

                        item[0] = data[selkey].orgId;
                        item[1] = v.code;
                        item[2] = v.name;
                        item[3] = data[selkey].pinyin;
                        // pinyinArr.push(item);
                        progress++;
                        console.log('已经完成: ' + progress + '/' + len);

                        fs.appendFile(this.pinyinFilePath, JSON.stringify(item) + ',', (err) => {
                            if (!err) {
                                console.log('拼音保存完成！');
                                // fs.writeFile(this.logFilePath,'已经完成: ' + progress + '/' + len,(err)=>{
                                //     if(!err){
                                //         console.log('日志记录完毕!');
                                //     }
                                // });
                            }
                        });

                    });

                });

            }
        });

    }
}

module.exports = PinyinSpider;