const path = require('path');
const Spider = require('./spider.js');
const PinyinSpider = require('./pinyin-spider');

// //股票
// const stockUrl = 'http://www.cninfo.com.cn/cninfo-new/information/companylist';
// const stockRawPath = path.join(__dirname,'./data-pool/stock.html');
// const stockCleanPath = path.join(__dirname,'./data-clean/stock.json');
// const stockSpider = new Spider(stockUrl,stockRawPath,stockCleanPath);
// stockSpider.run();

// //基金
// const fundUrl = 'http://www.cninfo.com.cn/cninfo-new/information/fundlist';
// const fundRawPath = path.join(__dirname,'./data-pool/fund.html');
// const fundCleanPath = path.join(__dirname,'./data-clean/fund.json');
// const fundSpider = new Spider(fundUrl,fundRawPath,fundCleanPath);
// fundSpider.run();

// //债券
// const bondUrl = 'http://www.cninfo.com.cn/cninfo-new/information/bondlist';
// const bondRawPath = path.join(__dirname,'./data-pool/bond.html');
// const bondCleanPath = path.join(__dirname,'./data-clean/bond.json');
// const bondSpider = new Spider(bondUrl,bondRawPath,bondCleanPath);
// bondSpider.run();

// // 股票 拼音
// const pinyinUrl = 'http://www.cninfo.com.cn/cninfo-new/information/topSearch/query';
// const cleanStock = path.join(__dirname, './data-clean/stock.json');
// const pinyinStock = path.join(__dirname, './data-pinyin/stock-pinyin.json');
// const log = path.join(__dirname, './log/pinyin.log');
// const pySpider = new PinyinSpider(pinyinUrl, cleanStock, pinyinStock, log);
// pySpider.run();

// // 基金 拼音
// const pinyinUrl = 'http://www.cninfo.com.cn/cninfo-new/information/topSearch/query';
// const cleanFund = path.join(__dirname, './data-clean/fund.json');
// const pinyinFund = path.join(__dirname, './data-pinyin/fund-pinyin.json');
// const log = path.join(__dirname, './log/pinyin.log');
// const pyFundSpider = new PinyinSpider(pinyinUrl, cleanFund, pinyinFund, log);
// pyFundSpider.run();

// 债券 拼音
const pinyinUrl = 'http://www.cninfo.com.cn/cninfo-new/information/topSearch/query';
const cleanBond = path.join(__dirname, './data-clean/bond.json');
const pinyinBond = path.join(__dirname, './data-pinyin/bond-pinyin.json');
const log = path.join(__dirname, './log/pinyin.log');
const pyBondSpider = new PinyinSpider(pinyinUrl, cleanBond, pinyinBond, log);
pyBondSpider.run();