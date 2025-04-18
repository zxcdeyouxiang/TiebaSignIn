/**
 * 数据处理模块
 */

/**
 * 处理签到结果数据
 * @param {Object} signResult - 签到结果
 * @returns {Object} 处理后的签到结果
 */
function processSignResult(signResult) {
  // 解析签到结果
  if (!signResult) {
    return { success: false, message: '签到结果为空' };
  }
  
  // 处理不同的成功状态码
  if (signResult.no === 0 && signResult.data.errmsg === 'success' && signResult.data.errno === 0) {
    return { 
      success: true, 
      message: '签到成功', 
      info: {
        rank: signResult.data.uinfo.user_sign_rank,
        signDays: signResult.data.uinfo.cont_sign_num 
      }
    };
  } else if (signResult.no === 1101) {
    return {
      success: true,
      message: '已经签到过了',
      info: {}
    };
  } else if (signResult.no === 2150040) {
    return {
      success: false,
      message: '签到失败，需要验证码',
      code: signResult.no,
      info: {}
    };
  } else if (signResult.no === 1011) {
    return {
      success: false,
      message: '未加入此吧或等级不够',
      code: signResult.no,
      info: {}
    };
  } else if (signResult.no === 1102) {
    return {
      success: false,
      message: '签到过快',
      code: signResult.no,
      info: {}
    };
  } else if (signResult.no === 1010) {
    return {
      success: false,
      message: '目录出错',
      code: signResult.no,
      info: {}
    };
  } else {
    return {
      success: false,
      message: signResult.error || `签到失败，错误码: ${signResult.no}`,
      code: signResult.no || -1,
      info: signResult.data || {}
    };
  }
}

/**
 * 汇总签到结果
 * @param {Array} results - 所有贴吧的签到结果
 * @returns {Object} 汇总结果
 */
function summarizeResults(results) {
  if (!results || !Array.isArray(results)) {
    return {
      total: 0,
      success: 0,
      alreadySigned: 0,
      failed: 0,
      errorMessages: {}
    };
  }
  
  const summary = {
    total: results.length,
    success: 0,
    alreadySigned: 0,
    failed: 0,
    errorMessages: {}
  };
  
  // 统计各种错误类型的数量
  results.forEach(result => {
    if (result.success) {
      if (result.message === '已经签到过了') {
        summary.alreadySigned += 1;
      } else {
        summary.success += 1;
      }
    } else {
      summary.failed += 1;
      
      // 统计错误消息类型数量
      if (!summary.errorMessages[result.message]) {
        summary.errorMessages[result.message] = 1;
      } else {
        summary.errorMessages[result.message]++;
      }
    }
  });
  
  return summary;
}

/**
 * 格式化汇总结果为文本
 * @param {Object} summary - 汇总结果
 * @returns {string} 格式化后的文本
 */
function formatSummary(summary) {
  let text = `📊 签到统计:\n`;
  text += `总计: ${summary.total} 个贴吧\n`;
  text += `✅ 成功: ${summary.success} 个\n`;
  text += `📌 已签: ${summary.alreadySigned} 个\n`;
  text += `❌ 失败: ${summary.failed} 个`;
  
  // 添加失败原因统计
  if (summary.failed > 0) {
    text += `\n\n❌ 失败原因:\n`;
    for (const [errorMessage, count] of Object.entries(summary.errorMessages)) {
      text += `- ${errorMessage}: ${count} 个\n`;
    }
  }
  
  return text;
}

module.exports = {
  processSignResult,
  summarizeResults,
  formatSummary
}; 