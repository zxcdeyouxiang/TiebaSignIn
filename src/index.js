// 百度贴吧自动签到 GitHub Action 脚本
const axios = require('axios');
const { login, getTiebaList, signTieba, getTbs } = require('./apiService');
const { processSignResult, summarizeResults, formatSummary } = require('./dataProcessor');
const { formatDate } = require('./utils');
const { sendNotification } = require('./notify');

// 执行主函数 - 使用立即执行的异步函数表达式
(async () => {
  const startTime = Date.now();
  try {
    console.log('==========================================');
    console.log('🏆 开始执行 百度贴吧自动签到 脚本...');
    console.log('==========================================');
    
    // 获取当前时间
    const now = new Date();
    
    // 标准时间和北京时间
    console.log(`📅 标准时间: ${formatDate(now, 'UTC', '+0')}`);
    console.log(`📅 北京时间: ${formatDate(now, 'Asia/Shanghai', '+8')}`);
    
    // 检查必要的环境变量
    if (!process.env.BDUSS) {
      throw new Error('缺少必要的环境变量: BDUSS');
    }
    
    const bduss = process.env.BDUSS;
    
    // 1. 验证登录凭证
    console.log('▶️ 步骤1: 验证登录凭证...');
    const userInfo = await login(bduss);
    console.log('✅ 验证BDUSS成功');
    
    // 2. 获取贴吧列表和TBS
    console.log('▶️ 步骤2: 获取贴吧列表和TBS...');
    const tiebaList = await getTiebaList(bduss);
    
    if (tiebaList.length === 0) {
      console.log('⚠️ 未找到关注的贴吧，可能是登录失效或没有关注贴吧');
    } else {
      console.log(`📋 共找到 ${tiebaList.length} 个关注的贴吧`);
    }
    
    // 3. 执行签到过程
    console.log('▶️ 步骤3: 开始签到过程...');
    
    // 获取TBS
    const tbs = await getTbs(bduss);
    
    // 配置批量签到的大小和间隔
    const batchSize = parseInt(process.env.BATCH_SIZE || '20', 10);
    const batchInterval = parseInt(process.env.BATCH_INTERVAL || '1000', 10);
    
    // 按批次处理签到
    const signResults = [];
    let alreadySignedCount = 0;
    let successCount = 0;
    let failedCount = 0;
    
    // 开始批量处理
    console.log(`📊 开始批量处理签到，每批 ${batchSize} 个，间隔 ${batchInterval}ms`);
    
    for (let i = 0; i < tiebaList.length; i += batchSize) {
      const batchTiebas = tiebaList.slice(i, i + batchSize);
      const batchPromises = [];
      
      const currentBatch = Math.floor(i/batchSize) + 1;
      const totalBatches = Math.ceil(tiebaList.length/batchSize);
      console.log(`📌 批次 ${currentBatch}/${totalBatches}: 处理 ${batchTiebas.length} 个贴吧`);
      
      for (let j = 0; j < batchTiebas.length; j++) {
        const tieba = batchTiebas[j];
        const tiebaName = tieba.forum_name;
        const tiebaIndex = i + j + 1; // 全局索引，仅用于结果存储
        
        // 已签到的贴吧跳过
        if (tieba.is_sign === 1) {
          alreadySignedCount++;
          signResults.push({
            success: true,
            message: '已经签到过了',
            name: tiebaName,
            index: tiebaIndex,
            info: {}
          });
          continue;
        }
        
        // 添加签到任务
        const signPromise = (async () => {
          try {
            const result = await signTieba(bduss, tiebaName, tbs, tiebaIndex);
            const processedResult = processSignResult(result);
            
            // 更新计数
            if (processedResult.success) {
              if (processedResult.message === '已经签到过了') {
                alreadySignedCount++;
              } else {
                successCount++;
              }
            } else {
              failedCount++;
            }
            
            return { 
              ...processedResult, 
              name: tiebaName,
              index: tiebaIndex
            };
          } catch (error) {
            failedCount++;
            return {
              success: false,
              message: error.message,
              name: tiebaName,
              index: tiebaIndex,
              info: {}
            };
          }
        })();
        
        batchPromises.push(signPromise);
      }
      
      // 等待当前批次的签到任务完成
      const batchResults = await Promise.all(batchPromises);
      signResults.push(...batchResults);
      
      // 每批次后输出简洁的进度统计
      console.log(`✅ 批次${currentBatch}完成: ${i + batchTiebas.length}/${tiebaList.length} | ` +
                 `成功: ${successCount} | 已签: ${alreadySignedCount} | 失败: ${failedCount}`);
      
      // 在批次之间添加延迟，除非是最后一批
      if (i + batchSize < tiebaList.length) {
        console.log(`⏳ 等待 ${batchInterval/1000} 秒后处理下一批...`);
        await new Promise(resolve => setTimeout(resolve, batchInterval));
      }
    }
    
    // 4. 汇总结果
    console.log('▶️ 步骤4: 汇总签到结果');
    const summary = summarizeResults(signResults);
    const summaryText = formatSummary(summary);
    
    // 完成
    console.log('==========================================');
    console.log(summaryText);
    console.log('==========================================');
    
    // 5. 发送通知
    if (process.env.ENABLE_NOTIFY === 'true') {
      console.log('▶️ 步骤5: 发送通知');
      await sendNotification(summaryText);
    }
    
  } catch (error) {
    console.error('==========================================');
    console.error(`❌ 错误: ${error.message}`);
    if (error.response) {
      console.error('📡 服务器响应:');
      console.error(`状态码: ${error.response.status}`);
      console.error(`数据: ${JSON.stringify(error.response.data)}`);
    }
    console.error('==========================================');
    
    // 发送错误通知
    if (process.env.ENABLE_NOTIFY === 'true') {
      try {
        await sendNotification(`❌ 签到脚本执行失败!\n\n错误信息: ${error.message}`);
      } catch (e) {
        console.error(`❌ 发送错误通知失败: ${e.message}`);
      }
    }
    
    process.exit(1); // 失败时退出程序，退出码为1
  } finally {
    // 无论成功还是失败都会执行的代码
    const endTime = Date.now();
    const executionTime = (endTime - startTime) / 1000;
    console.log(`⏱️ 总执行时间: ${executionTime.toFixed(2)}秒`);
    console.log('==========================================');
  }
})(); 