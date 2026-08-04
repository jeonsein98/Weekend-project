import React, { useState } from 'react';
import { X, Copy, Check, ExternalLink, Database, RefreshCw, AlertCircle, ShieldCheck } from 'lucide-react';
import { GasConfig } from '../types';
import { syncFromGas } from '../lib/storage';

interface GasSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  gasConfig: GasConfig;
  onSaveGasConfig: (config: GasConfig) => void;
  onResetSampleData: () => void;
  onShowToast: (message: string, type: 'success' | 'error' | 'info') => void;
}

const GAS_SCRIPT_CODE = `/**
 * 구글 시트(Google Sheets) 연동용 Google Apps Script (GAS) 코드
 * 
 * [설치 방법]
 * 1. 구글 시트 생성 -> 상단 메뉴 [확장 프로그램] -> [Apps Script] 클릭
 * 2. 아래 코드를 기존 내용 지우고 모두 붙여넣기 후 저장 (Ctrl+S)
 * 3. 오른쪽 상단 [배포] -> [새 배포] 클릭
 * 4. 유형 선택: [웹 앱]
 *    - 설명: 주말지낸이야기 API
 *    - 다음 사용자 권한으로 실행: [나]
 *    - 액세스 권한이 있는 사용자: [모든 사용자(Anyone)] (필수!)
 * 5. [배포] 클릭 후 생성된 웹 앱 URL을 복사하여 아래 설정창에 입력하세요.
 */

function doGet(e) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  var rows = sheet.getDataRange().getValues();
  var stories = [];
  
  if (rows.length > 1) {
    for (var i = 1; i < rows.length; i++) {
      var row = rows[i];
      if (!row[0]) continue;
      stories.push({
        id: row[0] || ('gas-' + i),
        week: row[1] || '',
        studentName: row[2] || '',
        title: row[3] || '',
        content: row[4] || '',
        imageUrl: row[5] || '',
        aiComment: row[6] || '',
        createdAt: row[7] || new Date().toISOString(),
        reactions: JSON.parse(row[8] || '{"❤️":0,"👏":0,"⭐":0,"😊":0}')
      });
    }
  }
  
  return ContentService.createTextOutput(JSON.stringify({ stories: stories }))
    .setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    
    // 헤더 없으면 생성
    if (sheet.getLastRow() === 0) {
      sheet.appendRow(["ID", "주차", "학생이름", "제목", "내용", "이미지URL", "AI소감", "등록일시", "리액션"]);
    }
    
    if (data.action === 'save' && data.story) {
      var s = data.story;
      sheet.appendRow([
        s.id,
        s.week,
        s.studentName,
        s.title,
        s.content,
        s.imageUrl || '',
        s.aiComment || '',
        s.createdAt || new Date().toISOString(),
        JSON.stringify(s.reactions || {})
      ]);
      return ContentService.createTextOutput(JSON.stringify({ status: "success" }))
        .setMimeType(ContentService.MimeType.JSON);
    }
    
    return ContentService.createTextOutput(JSON.stringify({ status: "error", message: "Invalid action" }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ status: "error", message: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}
`;

export const GasSettingsModal: React.FC<GasSettingsModalProps> = ({
  isOpen,
  onClose,
  gasConfig,
  onSaveGasConfig,
  onResetSampleData,
  onShowToast
}) => {
  const [webAppUrl, setWebAppUrl] = useState(gasConfig.webAppUrl || '');
  const [copied, setCopied] = useState(false);
  const [isTesting, setIsTesting] = useState(false);

  if (!isOpen) return null;

  const handleCopyCode = () => {
    navigator.clipboard.writeText(GAS_SCRIPT_CODE);
    setCopied(true);
    onShowToast('GAS 스크립트 코드가 복사되었습니다! 구글 시트 Apps Script에 붙여넣으세요.', 'success');
    setTimeout(() => setCopied(false), 3000);
  };

  const handleTestConnection = async () => {
    if (!webAppUrl.trim().startsWith('http')) {
      onShowToast('올바른 Google Apps Script 웹 앱 URL(https://script.google.com/...)을 입력해 주세요.', 'error');
      return;
    }

    setIsTesting(true);
    try {
      const result = await syncFromGas(webAppUrl.trim());
      if (result !== null) {
        onSaveGasConfig({
          webAppUrl: webAppUrl.trim(),
          isConnected: true,
          lastSyncedAt: new Date().toISOString()
        });
        onShowToast('구글 시트 연동에 성공했습니다!', 'success');
      } else {
        onSaveGasConfig({
          webAppUrl: webAppUrl.trim(),
          isConnected: false
        });
        onShowToast('구글 시트 응답이 유효하지 않습니다. 웹앱 배포 권한("모든 사용자")을 확인해 주세요.', 'error');
      }
    } catch (err) {
      console.error(err);
      onShowToast('구글 시트 연결 테스트 실패. URL 또는 배포 상태를 확인해 주세요.', 'error');
    } finally {
      setIsTesting(false);
    }
  };

  const handleDisconnect = () => {
    setWebAppUrl('');
    onSaveGasConfig({ webAppUrl: '', isConnected: false });
    onShowToast('구글 시트 연동이 해제되었습니다.', 'info');
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#2D2A26]/80 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white border border-[#E8E4D9] rounded-[32px] max-w-2xl w-full p-6 sm:p-8 text-[#3D3A35] shadow-xl relative my-8">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-[#E8E4D9] mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-[#7C8E7E] text-white flex items-center justify-center shadow-xs">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-serif font-bold text-[#2D2A26]">Google Sheets (GAS) 연동 설정</h2>
              <p className="text-xs text-[#8B8378]">구글 시트에 학급 주말지낸이야기 데이터를 영구 보관하세요.</p>
            </div>
          </div>
          <button
            id="gas-modal-close-btn"
            onClick={onClose}
            className="p-2 rounded-full text-[#8B8378] hover:text-[#2D2A26] hover:bg-[#F5F2ED] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-6">
          
          {/* Step 1: Copy Code */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-[#7C8E7E] uppercase tracking-wider flex items-center gap-1.5">
                <span>1단계:</span> Google Apps Script 코드 복사
              </label>
              <button
                id="gas-copy-code-btn"
                onClick={handleCopyCode}
                className="flex items-center gap-1.5 text-xs font-bold px-3.5 py-1.5 rounded-full bg-[#FAF9F6] hover:bg-[#F5F2ED] text-[#2D2A26] border border-[#E8E4D9] transition-all"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-[#7C8E7E]" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? '복사완료!' : '코드 복사하기'}</span>
              </button>
            </div>

            <div className="relative rounded-2xl border border-[#E8E4D9] bg-[#FAF9F6] p-3 text-[11px] font-mono text-[#5D574F] max-h-36 overflow-y-auto leading-relaxed">
              <pre>{GAS_SCRIPT_CODE}</pre>
            </div>
          </div>

          {/* Step 2: Web App URL Input */}
          <div className="space-y-2">
            <label htmlFor="gas-url-input" className="block text-xs font-bold text-[#7C8E7E] uppercase tracking-wider">
              2단계: 배포된 Google Apps Script 웹 앱 URL 입력
            </label>
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                id="gas-url-input"
                type="url"
                placeholder="https://script.google.com/macros/s/.../exec"
                value={webAppUrl}
                onChange={(e) => setWebAppUrl(e.target.value)}
                className="flex-1 bg-[#FAF9F6] border border-[#E8E4D9] rounded-2xl px-4 py-2.5 text-xs text-[#2D2A26] focus:outline-none focus:ring-2 focus:ring-[#7C8E7E] placeholder-[#A59F94] font-mono"
              />
              <button
                id="gas-test-btn"
                onClick={handleTestConnection}
                disabled={isTesting}
                className="flex items-center justify-center gap-1.5 px-6 py-2.5 rounded-full bg-[#7C8E7E] hover:bg-[#6A7B6C] text-white font-bold text-xs shadow-xs transition-all active:scale-95 disabled:opacity-50 shrink-0"
              >
                {isTesting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <ShieldCheck className="w-3.5 h-3.5" />}
                <span>연동 테스트</span>
              </button>
            </div>
          </div>

          {/* Connection Status Banner */}
          {gasConfig.isConnected && (
            <div className="p-4 rounded-2xl bg-[#F0F4F1] border border-[#C2D1C5] text-[#2D3A30] text-xs flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-[#7C8E7E] animate-ping" />
                <span className="font-bold">구글 시트와 정상 연동 중입니다.</span>
              </div>
              <button
                id="gas-disconnect-btn"
                onClick={handleDisconnect}
                className="text-[11px] text-rose-600 hover:underline font-bold"
              >
                연동 해제
              </button>
            </div>
          )}

          {/* Sample Data Reset */}
          <div className="pt-4 border-t border-[#E8E4D9] flex items-center justify-between">
            <div className="text-xs text-[#8B8378]">
              초기 예시 샘플 데이터로 복원하시겠습니까?
            </div>
            <button
              id="gas-reset-sample-btn"
              onClick={() => {
                if (confirm('모든 데이터를 초기 예시 샘플 데이터로 복원하시겠습니까?')) {
                  onResetSampleData();
                  onShowToast('초기 샘플 데이터로 복원되었습니다.', 'success');
                  onClose();
                }
              }}
              className="text-xs font-bold text-[#2D2A26] hover:text-[#7C8E7E] underline"
            >
              샘플 데이터 초기화
            </button>
          </div>

        </div>

      </div>
    </div>
  );
};
