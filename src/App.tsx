import { useState, useRef, useEffect } from "react";
import SplashPage from "./components/SplashPage";
import InputPage from "./components/InputPage";
import ResultPage from "./components/ResultPage";
import RegisterPage from "./components/RegisterPage";
import { EnergyResult, UserInput, TargetTime } from "./types";
import { auth, createSharedCalculation, fetchSharedCalculation, saveCalculation } from "./firebase";
import { onAuthStateChanged } from "firebase/auth";

export default function App() {
  const [userInput, setUserInput] = useState<UserInput | null>(null);
  const [result, setResult] = useState<EnergyResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [user, setUser] = useState<any>(null);

  const [lastTargetTime, setLastTargetTime] = useState<TargetTime | null>(null);
  const [calculationSaved, setCalculationSaved] = useState(false);
  const [shareLoading, setShareLoading] = useState(false);
  const lastSavedKeyRef = useRef<string>("");

  useEffect(() => {
    const shareIdFromPath = window.location.pathname.startsWith("/share/")
      ? window.location.pathname.split("/share/")[1]?.split("/")[0]
      : "";
    const shareId = shareIdFromPath || new URLSearchParams(window.location.search).get("share");

    if (!shareId) return;

    fetchSharedCalculation(shareId)
      .then((record: any) => {
        if (!record) {
          alert("分享链接不存在或已失效");
          return;
        }
        handleSelectRecord(record);
      })
      .catch((err) => {
        console.error(err);
        alert("分享链接加载失败，请稍后重试");
      });
  }, []);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, u => {
      setUser(u);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!user || !result || !userInput || !lastTargetTime || calculationSaved) return;

    const saveKey = JSON.stringify({ uid: user.uid, userInput, lastTargetTime, bazi: result.bazi, dayMaster: result.dayMaster });
    if (lastSavedKeyRef.current === saveKey) return;
    lastSavedKeyRef.current = saveKey;

    saveCalculation(userInput, result, lastTargetTime)
      .then(() => setCalculationSaved(true))
      .catch((err) => {
        lastSavedKeyRef.current = "";
        console.error(err);
      });
  }, [user, result, userInput, lastTargetTime, calculationSaved]);
  
  const containerRef = useRef<HTMLDivElement>(null);
  const handleInputSubmit = (data: UserInput) => {
    setUserInput(data);
    setTimeout(() => {
      document.getElementById('result-section')?.scrollIntoView({ behavior: "smooth" });
    }, 100);
  };

  const handleCalculate = async (targetTimes: TargetTime) => {
    if (!userInput) return;
    setIsLoading(true);
    setLastTargetTime(targetTimes);
    setCalculationSaved(false);
    
    try {
      const response = await fetch("/api/calculate-energy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...userInput, ...targetTimes }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => null);
        if (errData && errData.error) {
           throw new Error(errData.error);
        }
        throw new Error("Failed to fetch calculation.");
      }

      const resData = await response.json();
      setResult(resData);
    } catch (err: any) {
      alert("测量出错: " + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectRecord = (record: any) => {
    let safePeriods = record.periods;
    let fallbackScore = record.score || record.periods?.yearly?.score || 0;

    if (!safePeriods || !safePeriods.yearly) {
      safePeriods = {
        yearly: { title: "流年", subtitle: "往期", description: "此为旧版格式记录，如需详细解读请点击下方【更新测算】。", score: fallbackScore, aspects: [] },
        monthly: { title: "流月", subtitle: "往期", description: "此为旧版格式记录，请重新测算获取。", score: fallbackScore, aspects: [] },
        daily: { title: "流日", subtitle: "往期", description: "此为旧版格式记录，请重新测算获取。", score: fallbackScore, aspects: [] },
        hourly: { title: "流时", subtitle: "往期", description: "此为旧版格式记录，请重新测算获取。", score: fallbackScore, aspects: [] }
      };
    }

    setUserInput(record.userInput || null);
    setResult({
      bazi: record.bazi || "",
      dayMaster: record.dayMaster || "",
      periods: safePeriods,
      score: fallbackScore
    });
    setLastTargetTime({
      targetYear: record.targetYear,
      targetMonth: record.targetMonth,
      targetDay: record.targetDay,
      targetHour: record.targetHour,
    });
    setCalculationSaved(true);
    
    setTimeout(() => {
      document.getElementById('result-section')?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 150);
  };

  const handleShare = async () => {
    if (!userInput || !result || !lastTargetTime) {
      alert("请先完成一次测算后再分享");
      return;
    }

    setShareLoading(true);
    try {
      const shareId = await createSharedCalculation(userInput, result, lastTargetTime);
      const shareUrl = `${window.location.origin}/share/${shareId}`;
      await navigator.clipboard?.writeText(shareUrl);
      alert("分享链接已复制，可以发送给朋友查看。");
    } catch (err: any) {
      console.error(err);
      alert("分享失败：" + (err.message || "请稍后重试"));
    } finally {
      setShareLoading(false);
    }
  };

  return (
    <main 
      ref={containerRef}
      className="h-[100dvh] w-full snap-y snap-mandatory overflow-y-auto overflow-x-hidden scroll-smooth selection:bg-[#C9E0F5]"
    >
       <SplashPage />
       <InputPage onCalculate={handleInputSubmit} />
       
       <div className="contents">
         {userInput ? (
           <ResultPage 
              userInput={userInput} 
              result={result} 
              onGenerate={handleCalculate} 
              isLoading={isLoading} 
              onShare={handleShare}
              shareLoading={shareLoading}
           />
         ) : (
           <section id="result-section" className="h-[100dvh] w-full snap-start snap-always relative flex flex-col items-center justify-center p-6 text-center opacity-50">
             <div className="text-[#3F63A8] text-sm">请先在上方完成生辰输入</div>
           </section>
         )}
         <RegisterPage onSelectRecord={handleSelectRecord} />
       </div>
    </main>
  );
}
