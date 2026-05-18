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
  const streamRef = useRef<MediaStream | null>(null); // 🌟 Giữ luồng Camera cố định, không chớp nháy
  const [status, setStatus] = useState<'loading' | 'monitoring' | 'error'>('loading');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    let isMounted = true;
    let model: cocossd.ObjectDetection | null = null;
    let lastAlertTime = 0; // Chống spam cảnh báo

    const setupCameraAndAI = async () => {
      try {
        // 1. TỐI ƯU 1: Ép độ phân giải thấp (320x240) để giảm tải 80% CPU cho máy học sinh
        const stream = await navigator.mediaDevices.getUserMedia({ 
          video: { 
            facingMode: "user",
            width: { ideal: 320 },
            height: { ideal: 240 }
          }, 
          audio: false 
        });
        
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }

        // 2. Tải mô hình AI nhận diện (Sẽ mất vài giây tùy mạng)
        await tf.ready();
        model = await cocossd.load();
        if (isMounted) setStatus('monitoring');

        // 3. TỐI ƯU 2: Vòng lặp đệ quy thông minh (Chống treo máy)
        const scanFrame = async () => {
          if (!isMounted) return; // Nếu học sinh nộp bài, lập tức ngắt AI

          if (videoRef.current && model && videoRef.current.readyState === 4) {
            try {
              // Bắt đầu quét khung hình
              const predictions = await model.detect(videoRef.current);
              
              const persons = predictions.filter(p => p.class === 'person');
              const phones = predictions.filter(p => p.class === 'cell phone');

              const now = Date.now();
              // Chỉ báo lỗi nếu khoảng cách giữa 2 lần quá 5 giây (Tránh hù dọa học sinh liên tục)
              if (now - lastAlertTime > 5000) {
                if (phones.length > 0) {
                  onViolation('🔴 AI PHÁT HIỆN: Bạn đang cầm thiết bị nghi là điện thoại!');
                  lastAlertTime = now;
                } else if (persons.length > 1) {
                  onViolation('🔴 AI PHÁT HIỆN: Có người lạ xuất hiện trong khung hình của bạn!');
                  lastAlertTime = now;
                } else if (persons.length === 0) {
                  onViolation('🟡 NHẮC NHỞ: Không tìm thấy khuôn mặt. Vui lòng ngồi thẳng vào giữa màn hình!');
                  lastAlertTime = now;
                }
              }
            } catch (e) {
              console.error("Lỗi AI khi quét:", e);
            }
          }

          // CHỈ KHI quét xong, mới hẹn giờ 3 giây sau quét tiếp. Tránh chồng chéo lệnh.
          setTimeout(scanFrame, 3000);
        };

        // Kích hoạt nhịp đập của AI
        scanFrame();

      } catch (err: any) {
        if (isMounted) {
          setStatus('error');
          setErrorMessage('Không thể bật Camera. Vui lòng kiểm tra quyền trình duyệt!');
        }
      }
    };

    setupCameraAndAI();

    // 4. TỐI ƯU 3: Dọn dẹp cực kỳ cẩn thận khi Component bị đóng
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
        className="w-full h-40 md:h-48 object-cover transform scale-x-[-1]" // Lật video như soi gương
      />
      
      {/* Overlay Trạng thái AI */}
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
        
        {/* Nút đỏ nhấp nháy mô phỏng Camera đang ghi hình */}
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