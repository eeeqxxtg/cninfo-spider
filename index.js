const path = require('path');

const Cnspider = require('./src/cninfo-spider.js');


const cnspider = new Cnspider({
    stockUrl: 'http://www.cninfo.com.cn/cninfo-new/information/companylist',
    fundUrl: 'http://www.cninfo.com.cn/cninfo-new/information/fundlist',
    bondUrl: 'http://www.cninfo.com.cn/cninfo-new/information/bondlist',
    pinyinQueryUrl: 'http://www.cninfo.com.cn/cninfo-new/information/topSearch/query',
    //以下三个参数是针对抓取拼音设置的
    //每100ms抓取一次，每连续抓取8个拼音就休息5000ms
    //经测试，实际抓取中三个参数配置 100 100 30000比较合理
    tick: 100,
    numEveryTime: 100,
    rest: 5000,
});

// cnspider.getContent(()=>{
//     console.log('三个文件抓取完成');
// });

// cnspider.cleanData(()=>{
//     console.log('三个文件清洗完成');
// });

// cnspider.getPinyin(() => {
//     console.log('三个文件都拿到拼音');
// });

// cnspider.simplefy(()=>{
//     console.log('三个拼音文件轻量化完成');
// });

// cnspider.run();

// Cnspider.compareFile('../spider/data-clean/stock.json', './data/data-clean/stock.json');
// Cnspider.compareFile('../spider/data-clean/fund.json', './data/data-clean/fund.json');
// Cnspider.compareFile('../spider/data-clean/bond.json', './data/data-clean/bond.json');

// cnspider.compare();

// Cnspider.compareFile('./data/test1.json','./data/test2.json',null,'./data/test12.json');
//
// Cnspider.updateCleanFile('./data/test1.json','./data/test12.json');
// Cnspider.updatePinyinFile('./data/test1-pinyin.json','./data/test12.json');

cnspider.repair();


//http://api.cninfo.com.cn/service/dataItem?jsonpCallback=jQuery183016118301232528132_1494308550025&codelist=sh1A0001%2Csz399001%2Csz399005%2Csz399006&_=1494347849977