// ==UserScript==
// @name         GA4 Report Data Copier
// @namespace    http://tampermonkey.net/
// @version      1.2
// @description  Copy data from GA4 reports with one click
// @author       Xin.Chen
// @match        https://analytics.google.com/*
// @grant        GM_log
// @run-at       document-start
// ==/UserScript==

(function() {
    'use strict';

    // Debug utilities
    const DEBUG = {
        enabled: false,
        log: function(...args) {
            if (this.enabled) {
                console.log('%c[GA4 Copier]', 'color: #1a73e8; font-weight: bold;', ...args);
            }
        },
        error: function(...args) {
            if (this.enabled) {
                console.error('%c[GA4 Copier]', 'color: #e34234; font-weight: bold;', ...args);
            }
        }
    };

    // Styles configuration
    const STYLES = {
        button: {
            default: `
                margin-left: 10px;
                padding: 8px 16px;
                background-color: #1a73e8;
                color: white;
                border: none;
                border-radius: 4px;
                cursor: pointer;
                font-size: 14px;
            `,
            hover: '#1557b0',
            normal: '#1a73e8'
        },
        toast: `
            position: fixed;
            bottom: 20px;
            left: 50%;
            transform: translateX(-50%);
            background-color: #4caf50;
            color: white;
            padding: 10px 20px;
            border-radius: 4px;
            z-index: 10000;
        `,
        debugButton: `
            position: fixed;
            bottom: 20px;
            right: 20px;
            padding: 8px 16px;
            background-color: #ff9800;
            color: white;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            z-index: 10000;
        `
    };
    function extractDataToCSV(svgDom) {
        // 寻找所有的文本元素
        const gs = svgDom.querySelectorAll('g.cell');
        // 初始化一个数组来存储每行的数据
        let csvData = [];
        let row = [];
        let lastpos = 0;
        // 遍历所有的文本元素
        gs.forEach(g => {
            if(g.getAttribute('row-index') != 0 ){
                const value = g.querySelectorAll('text')[0].textContent.trim();
                // 检查是否为每行的最后一个单元格
                if (g.getAttribute('row-index') != lastpos) {
                    lastpos = g.getAttribute('row-index');
                    // 将当前行添加到CSV数据数组中，并开始新的一行
                    csvData.push(row.join('\t'));
                    row = [];
                }
                // 将文本值添加到当前行
                row.push(value);
            }
        });
        if(row.length){
            csvData.push(row.join('\t'));
        }
        // 返回CSV格式的字符串
        return csvData.join('\n');
    }
    // Data handling utilities
    const DataHandler = {
        extractTableData(chart) {
            const table = chart.querySelector('table');
            if (!table) {
                DEBUG.log('No table found in chart');
                return null;
            }

            const rows = Array.from(table.querySelectorAll('tr'));
            return rows.map(row => {
                const cells = Array.from(row.querySelectorAll('th, td'));
                return cells.map(cell => cell.textContent.trim()).join('\t');
            }).join('\n');
        },

        async copyChartData() {
            try {
                const charts = document.querySelectorAll('.aplos-chart-svg');
                DEBUG.log(`Found ${charts.length} charts`);
                if (!charts.length) {
                    alert('未找到图表数据！');
                    return;
                }
                let allData = '';
                charts.forEach((chart, index) => {

                    const tableData = extractDataToCSV(chart) ;// DataHandler.extractTableData(chart);
                    if (tableData) {
                        // allData += `图表 ${index + 1}:\n${tableData}\n\n`;
                        allData += tableData;
                    }
                });

                if (allData) {
                    await navigator.clipboard.writeText(allData.trim());
                    DOMUtils.showToast('复制成功！');
                    DEBUG.log('Data copied successfully');
                } else {
                    alert('没有找到可复制的数据！');
                    DEBUG.error('No data found to copy');
                }
            } catch (error) {
                DEBUG.error('Copy failed:', error);
                alert('复制失败，请重试！');
            }
        }
    };

    // DOM manipulation utilities
    const DOMUtils = {
        createCopyButton() {
            DEBUG.log('Creating copy button');
            const button = document.createElement('button');
            button.innerHTML = '一键复制数据';
            button.setAttribute('data-ga4-copy-button', 'true');
            button.style.cssText = STYLES.button.default;

            button.addEventListener('mouseover', () => {
                button.style.backgroundColor = STYLES.button.hover;
            });

            button.addEventListener('mouseout', () => {
                button.style.backgroundColor = STYLES.button.normal;
            });

            button.addEventListener('click', DataHandler.copyChartData);
            return button;
        },
        createDebugButton() {
            const button = document.createElement('button');
            button.innerHTML = 'Debug Info';
            button.style.cssText = STYLES.debugButton;
            button.addEventListener('click', DebugUtils.showDebugInfo);
            return button;
        },
        showToast(message, duration = 2000) {
            const toast = document.createElement('div');
            toast.textContent = message;
            toast.style.cssText = STYLES.toast;
            document.body.appendChild(toast);
            setTimeout(() => toast.remove(), duration);
        }
    };

    // Debug utilities
    const DebugUtils = {
        showDebugInfo() {
            const headerControls = document.querySelector('.analysis-area-header-controls');
            const copyButton = document.querySelector('[data-ga4-copy-button]');
            const charts = document.querySelectorAll('.aplos-chart');

            const debugInfo = {
                'Script Version': '1.2',
                'Header Controls Found': !!headerControls,
                'Copy Button Added': !!copyButton,
                'Charts Found': charts.length,
                'Observer Active': !!window._ga4Observer
            };
            console.table(debugInfo);
            alert(`调试信息已输出到控制台\n
Header Controls: ${debugInfo['Header Controls Found'] ? '✅' : '❌'}
Copy Button: ${debugInfo['Copy Button Added'] ? '✅' : '❌'}
Charts: ${debugInfo['Charts Found']}`);
        }
    };

    // DOM Observer
    const DOMObserver = {
        observer: null,

        addCopyButtonIfNeeded(headerControls) {
            if (!headerControls) {
                DEBUG.log('Header controls not found');
                return;
            }

            const existingButton = headerControls.querySelector('[data-ga4-copy-button]');
            if (!existingButton) {
                DEBUG.log('Adding copy button to header controls');
                const copyButton = DOMUtils.createCopyButton();
                headerControls.appendChild(copyButton);
            }
        },

        start() {
            DEBUG.log('Starting DOM observer');

            if (this.observer) {
                this.observer.disconnect();
                DEBUG.log('Disconnected old observer');
            }

            this.observer = new MutationObserver((mutations) => {
                mutations.forEach(mutation => {
                    if (mutation.addedNodes.length) {
                        const headerControls = document.querySelector('.analysis-area-header-controls');
                        if (headerControls) {
                            // DEBUG.log('Header controls found in mutation');
                            this.addCopyButtonIfNeeded(headerControls);
                        }
                    }
                });
            });

            this.observer.observe(document.body, {
                childList: true,
                subtree: true
            });

            window._ga4Observer = this.observer;
            DEBUG.log('DOM observer started');

            const headerControls = document.querySelector('.analysis-area-header-controls');
            if (headerControls) {
                this.addCopyButtonIfNeeded(headerControls);
            }
        },

        checkStatus() {
            if (!this.observer) {
                DEBUG.log('Observer lost, restarting...');
                this.start();
            }
        }
    };

    // Initialize the script
    function init() {
        DEBUG.log('Initializing GA4 Data Copier');

        if (DEBUG.enabled) {
            document.body.appendChild(DOMUtils.createDebugButton());
        }

        DOMObserver.start();
        setInterval(() => DOMObserver.checkStatus(), 5000);
    }

    // Start script execution
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();