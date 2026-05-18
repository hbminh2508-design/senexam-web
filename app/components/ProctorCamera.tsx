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
  const [status, setStatus] = useState<'loading' | 'monitoring' | 'error'>('loading');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    let model: cocossd.ObjectDetection | null = null;
    let detectionInterval: NodeJS.Timeout;
    let lastAlertTime = 0; // Chống spam cảnh báo liên tục

    const initProctoring = async () => {
      try {
        // 1. Xin quyền truy cập Camera của thí sinh
        const stream = await navigator.mediaDevices.getUserMedia({ 
          video: { facingMode: "user" }, // Ưu tiên camera trước
          audio: false 
        });
        
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }

        // 2. Tải mô hình AI nhận diện vật thể (Lần đầu mất khoảng vài giây)
        await tf.ready();
        model = await cocossd.load();
        setStatus('monitoring');

        // 3. Vòng lặp quét Camera (Mỗi 2.5 giây 1 lần)
        detectionInterval = setInterval(async () => {
          if (videoRef.current && model && videoRef.current.readyState === 4) {
            const predictions = await model.detect(videoRef.current);
            
            // Lọc ra người và điện thoại từ AI
            const persons = predictions.filter(p => p.class === 'person');
            const phones = predictions.filter(p => p.class === 'cell phone');

            const now = Date.now();
            // Nếu phát hiện gian lận, báo cáo (Giới hạn 5 giây mới báo 1 lần để không bị spam màn hình)
            if (now - lastAlertTime > 5000) {
              if (phones.length > 0) {
                onViolation('🔴 CẢNH BÁO: Phát hiện thí sinh sử dụng điện thoại!');
                lastAlertTime = now;
              } else if (persons.length > 1) {
                onViolation('🔴 CẢNH BÁO: Phát hiện có người lạ trong khu vực thi!');
                lastAlertTime = now;
              } else if (persons.length === 0) {
                onViolation('🟡 NHẮC NHỞ: Không tìm thấy khuôn mặt thí sinh. Yêu cầu ngồi ngay ngắn!');
                lastAlertTime = now;
              }
            }
          }
        }, 2500);

      } catch (err: any) {
        setStatus('error');
        setErrorMessage('Không thể bật Camera. Hãy cấp quyền trong trình duyệt để thi!');
        onViolation('LỖI CAMERA: Học sinh từ chối cấp quyền hoặc Camera bị hỏng!');
      }
    };

    initProctoring();

    // Dọn dẹp bộ nhớ và tắt Camera khi học sinh nộp bài hoặc rời trang
    return () => {
      if (detectionInterval) clearInterval(detectionInterval);
      if (videoRef.current?.srcObject) {
        const tracks = (videoRef.current.srcObject as MediaStream).getTracks();
        tracks.forEach(track => track.stop());
      }
    };
  }, [onViolation]);

  return (
    <div className="bg-slate-900 rounded-2xl overflow-hidden relative shadow-lg border border-slate-700 w-[240px] md:w-[300px]">
      <video 
        ref={videoRef} 
        autoPlay 
        muted 
        playsInline 
        className="w-full h-40 md:h-48 object-cover transform scale-x-[-1]" // Lật ngược video như gương
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
           status === 'error' ? 'Lỗi Camera' : 'Đang tải Mô hình AI...'}
        </div>
        
        {/* Nút đỏ nhấp nháy mô phỏng Camera đang quay */}
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