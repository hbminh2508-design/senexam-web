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

  // 🌟 GIẢI PHÁP CHỐNG NHẤP NHÁY: Lưu hàm phạt vào Ref để không làm khởi động lại Camera
  const onViolationRef = useRef(onViolation);
  useEffect(() => {
    onViolationRef.current = onViolation;
  }, [onViolation]);

  useEffect(() => {
    let isMounted = true;
    let model: cocossd.ObjectDetection | null = null;
    let lastAlertTime = 0; 
    let scanTimer: NodeJS.Timeout;

    const setupCameraAndAI = async () => {
      try {
        // 1. Chỉ xin quyền và bật Camera ĐÚNG 1 LẦN DUY NHẤT
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
              // 2. AI ĐỌC ẢNH TỪ CAMERA CŨ (Không tắt bật Camera)
              const predictions = await model.detect(videoRef.current, 20, 0.25);
              
              const persons = predictions.filter(p => p.class === 'person' && p.score > 0.4);
              const forbiddenDevices = predictions.filter(p => 
                ['cell phone', 'laptop', 'tv', 'remote'].includes(p.class)
              );

              const now = Date.now();
              if (now - lastAlertTime > 5000) {
                if (forbiddenDevices.length > 0) {
                  const device = forbiddenDevices[0];
                  const score = Math.round(device.score * 100);
                  const deviceName = device.class === 'cell phone' ? 'điện thoại' : 'thiết bị lạ';
                  
                  onViolationRef.current(`🔴 AI PHÁT HIỆN: Bạn đang cầm ${deviceName} để chụp/tra cứu! (Tỷ lệ: ${score}%)`);
                  lastAlertTime = now;
                } 
                else if (persons.length > 1) {
                  onViolationRef.current('🔴 AI PHÁT HIỆN: Có người lạ xuất hiện trong khu vực thi để hỗ trợ!');
                  lastAlertTime = now;
                }
              }
            } catch (e) {
              console.error("Lỗi AI khi quét:", e);
            }
          }

          // 3. Chu kỳ 3 giây lặp lại việc AI trích xuất ảnh 1 lần
          scanTimer = setTimeout(scanFrame, 3000);
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

    // 4. CHỈ TẮT CAMERA KHI HỌC SINH NỘP BÀI HOẶC THOÁT KHỎI PHÒNG THI
    return () => {
      isMounted = false;
      clearTimeout(scanTimer);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []); // 🌟 DEPENDENCY RỖNG: Đây là mấu chốt giúp Camera tuyệt đối không bị khởi động lại!

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