'use client'

import { useEffect, useRef, useState } from 'react'
import * as tf from '@tensorflow/tfjs'
import * as cocossd from '@tensorflow-models/coco-ssd'
import { AlertTriangle, ShieldCheck, Loader2 } from 'lucide-react'

interface ProctorCameraProps {
  onViolation: (message: string) => void;
}

export default function ProctorCamera({ onViolation }: ProctorCameraProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [status, setStatus] = useState<'loading' | 'monitoring' | 'error'>('loading');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    let isMounted = true;
    let model: cocossd.ObjectDetection | null = null;
    let lastAlertTime = 0; 

    const setupCameraAndAI = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ 
          video: { 
            facingMode: "user",
            width: { ideal: 640 }, 
            height: { ideal: 480 } 
          }, 
          audio: false 
        });
        
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }

        await tf.ready();
        model = await cocossd.load();
        if (isMounted) setStatus('monitoring');

        const scanFrame = async () => {
          if (!isMounted) return; 

          if (videoRef.current && model && videoRef.current.readyState === 4) {
            try {
              // Ép độ nhạy thiết bị xuống 25% (0.25) để quét cực gắt các vật thể cầm tay
              const predictions = await model.detect(videoRef.current, 20, 0.25);
              
              // Người thì vẫn cần chuẩn 40% để tránh bắt nhầm bóng ma
              const persons = predictions.filter(p => p.class === 'person' && p.score > 0.4);
              
              // Mở rộng bắt gian lận: Điện thoại, Laptop, Màn hình, Điều khiển
              const forbiddenDevices = predictions.filter(p => 
                ['cell phone', 'laptop', 'tv', 'remote'].includes(p.class)
              );

              const now = Date.now();
              if (now - lastAlertTime > 5000) {
                
                // ƯU TIÊN 1: Bắt thiết bị điện tử (Bất chấp có người hay không)
                if (forbiddenDevices.length > 0) {
                  const device = forbiddenDevices[0];
                  const score = Math.round(device.score * 100);
                  const deviceName = device.class === 'cell phone' ? 'điện thoại' : 'thiết bị lạ';
                  
                  onViolation(`🔴 AI PHÁT HIỆN: Bạn đang cầm ${deviceName} để chụp/tra cứu! (Tỷ lệ: ${score}%)`);
                  lastAlertTime = now;
                } 
                // ƯU TIÊN 2: Bắt người lạ hỗ trợ làm bài
                else if (persons.length > 1) {
                  onViolation('🔴 AI PHÁT HIỆN: Có người lạ xuất hiện trong khu vực thi để hỗ trợ!');
                  lastAlertTime = now;
                }
                
                // 🌟 ĐÃ XÓA BỎ LỆNH PHẠT KHI KHÔNG THẤY MẶT (Cho phép học sinh thoải mái cúi nháp bài)
              }
            } catch (e) {
              console.error("Lỗi AI khi quét:", e);
            }
          }

          // Quét 2 giây 1 lần
          setTimeout(scanFrame, 2000);
        };

        scanFrame();

      } catch (err: any) {
        if (isMounted) {
          setStatus('error');
          setErrorMessage('Không thể bật Camera. Vui lòng kiểm tra quyền trình duyệt!');
        }
      }
    };

    setupCameraAndAI();

    return () => {
      isMounted = false;
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, [onViolation]);

  return (
    <div className="bg-slate-900 rounded-2xl overflow-hidden relative shadow-[0_10px_40px_rgba(0,0,0,0.5)] border border-slate-700 w-[240px] md:w-[300px]">
      <video 
        ref={videoRef} 
        autoPlay 
        muted 
        playsInline 
        className="w-full h-40 md:h-48 object-cover transform scale-x-[-1]" 
      />
      
      <div className="absolute top-2 left-2 right-2 flex justify-between items-center z-10">
        <div className={`px-2.5 py-1.5 rounded-lg text-[10px] font-black flex items-center gap-1.5 backdrop-blur-md border ${
          status === 'monitoring' ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' : 
          status === 'error' ? 'bg-red-500/20 text-red-400 border-red-500/30' : 
          'bg-blue-500/20 text-blue-400 border-blue-500/30'
        }`}>
          {status === 'monitoring' ? <ShieldCheck className="w-3 h-3"/> : 
           status === 'error' ? <AlertTriangle className="w-3 h-3"/> : 
           <Loader2 className="w-3 h-3 animate-spin"/>}
           
          {status === 'monitoring' ? 'AI Đang Giám Sát' : 
           status === 'error' ? 'Lỗi Camera' : 'Đang tải AI...'}
        </div>
        
        <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse shadow-[0_0_8px_rgba(239,68,68,0.8)]"></div>
      </div>

      {status === 'error' && (
        <div className="absolute inset-0 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-4 text-center z-20">
          <p className="text-red-400 font-bold text-xs">{errorMessage}</p>
        </div>
      )}
    </div>
  )
}