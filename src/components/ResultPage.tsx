import { useState, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import useEmblaCarousel from "embla-carousel-react";
import { Sparkles, Briefcase, Heart, Leaf, X, Compass, Loader2, Share2 } from "lucide-react";
import { EnergyResult, Aspect, UserInput, TargetTime } from "../types";

const icons = {
  事业: <Briefcase className="w-4 h-4 text-[#8AAAE5]" />,
  财运: <span className="text-[#DEB887] text-lg leading-none p-0 flex items-center justify-center">✧</span>,
  感情: <Heart className="w-4 h-4 text-[#E6A8A8]" />,
  健康: <Leaf className="w-4 h-4 text-[#A1C9A4]" />
};

function ScrollPicker({ items, value, onChange }: { items: {label: string, value: any, subtitle?: string}[], value: any, onChange: (val: any) => void }) {
  const [emblaRef, emblaApi] = useEmblaCarousel({ 
    loop: false, 
    axis: 'x', 
    startIndex: Math.max(0, items.findIndex(i => i.value === value)),
    align: 'center',
    containScroll: false
  });

  const onSelect = useCallback(() => {
    if (!emblaApi) return;
    const idx = emblaApi.selectedScrollSnap();
    if (items[idx]) {
      onChange(items[idx].value);
    }
  }, [emblaApi, items, onChange]);

  useEffect(() => {
    if (!emblaApi) return;
    emblaApi.on("select", onSelect);
    return () => { emblaApi.off("select", onSelect); };
  }, [emblaApi, onSelect]);

  useEffect(() => {
    if (!emblaApi) return;
    const idx = items.findIndex(i => i.value === value);
    if (idx !== -1 && emblaApi.selectedScrollSnap() !== idx) {
      emblaApi.scrollTo(idx);
    }
  }, [value, emblaApi, items]);

  return (
    <div className="w-full h-32 relative flex items-center bg-[#f4f7fc]/50 rounded-[2rem] my-4 overflow-hidden" ref={emblaRef}>
      <div className="flex w-full select-none touch-pan-x cursor-grab active:cursor-grabbing">
        {items.map((item, idx) => {
          const active = value === item.value;
          return (
            <div 
              key={idx} 
              className="flex-[0_0_25%] min-w-0 flex items-center justify-center cursor-pointer"
              onClick={() => onChange(item.value)}
            >
              <div className={`flex flex-col items-center justify-center transition-all duration-300 ${
                  active ? 'w-[4.5rem] h-24 bg-white shadow-[0_4px_15px_rgba(114,162,244,0.15)] rounded-2xl scale-105' : 'w-14 h-16 opacity-40 hover:opacity-80'
              }`}>
                <span className={`text-[10px] mb-1 font-medium tracking-widest ${active ? 'text-[#7F92B3]' : 'text-[#A0B0C8]'}`}>
                  {item.label}
                </span>
                <span className={`font-serif-sc font-medium ${active ? 'text-2xl text-[#1E2D4A]' : 'text-lg text-[#4E5D78]'}`}>
                  {typeof item.value === 'string' && item.value.includes('时') ? item.value.split(' ')[0] : item.value}
                </span>
                {active && (
                  item.subtitle ? (
                    <span className="text-[9px] text-[#A0B0C8] mt-1 font-medium tracking-widest scale-90 whitespace-nowrap">
                      {item.subtitle}
                    </span>
                  ) : (
                    <div className="w-1 h-1 rounded-full bg-[#3F63A8]/40 mt-1.5" />
                  )
                )}
              </div>
            </div>
          );
        })}
      </div>
      <div className="absolute left-0 top-0 bottom-0 w-8 bg-gradient-to-r from-white to-transparent pointer-events-none rounded-l-[2rem]" />
      <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-white to-transparent pointer-events-none rounded-r-[2rem]" />
    </div>
  );
}

export default function ResultPage({ 
  userInput, 
  result, 
  onGenerate, 
  isLoading,
  onShare,
  shareLoading = false
}: { 
  userInput: UserInput | null;
  result: EnergyResult | null;
  onGenerate: (t: TargetTime) => void;
  isLoading: boolean;
  onShare?: () => void;
  shareLoading?: boolean;
}) {
  const [emblaRef, emblaApi] = useEmblaCarousel({ loop: false, watchDrag: !!result });
  const [selectedIndex, setSelectedIndex] = useState(0); 
  
  // Selection States
  const curDate = new Date();
  const [targetYear, setTargetYear] = useState<number>(curDate.getFullYear());
  const [targetMonth, setTargetMonth] = useState<number>(curDate.getMonth() + 1);
  const [targetDay, setTargetDay] = useState<number>(curDate.getDate());
  const [targetHour, setTargetHour] = useState<string>("子时 (23:00-00:59)");

  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerType, setPickerType] = useState<string>("");
  const [tempValue, setTempValue] = useState<any>(null);
  
  const [selectedAspectInfo, setSelectedAspectInfo] = useState<{ aspect: Aspect, periodTitle: string } | null>(null);

  const periods = result ? [
    { title: "流年", data: result.periods.yearly, icon: "☀️", id: "yearly" },
    { title: "流月", data: result.periods.monthly, icon: "🌙", id: "monthly" },
    { title: "流日", data: result.periods.daily, icon: "🌟", id: "daily" },
    { title: "流时", data: result.periods.hourly, icon: "🕒", id: "hourly" }
  ] : [];

  const onSelect = useCallback(() => {
    if (!emblaApi) return;
    setSelectedIndex(emblaApi.selectedScrollSnap());
  }, [emblaApi]);

  useEffect(() => {
    if (!emblaApi) return;
    emblaApi.on("select", onSelect);
    return () => { emblaApi.off("select", onSelect); };
  }, [emblaApi, onSelect]);

  const scrollTo = useCallback((index: number) => {
    if (emblaApi) emblaApi.scrollTo(index);
  }, [emblaApi]);

  const handleOpenPicker = (type: string) => {
    setPickerType(type);
    
    // Set initial temp value
    if (type === "yearly") setTempValue(targetYear);
    if (type === "monthly") setTempValue(targetMonth);
    if (type === "daily") setTempValue(targetDay);
    if (type === "hourly") setTempValue(targetHour);
    
    setPickerOpen(true);
  };

  const handleConfirmPicker = () => {
    if (tempValue !== null) {
      if (pickerType === "yearly") {
        setTargetYear(tempValue);
        const newDays = new Date(tempValue, targetMonth, 0).getDate();
        if (targetDay > newDays) setTargetDay(newDays);
      }
      if (pickerType === "monthly") {
        setTargetMonth(tempValue);
        const newDays = new Date(targetYear, tempValue, 0).getDate();
        if (targetDay > newDays) setTargetDay(newDays);
      }
      if (pickerType === "daily") setTargetDay(tempValue);
      if (pickerType === "hourly") setTargetHour(tempValue);
    }
    setPickerOpen(false);
  };

  const handleGenerate = () => {
    onGenerate({
      targetYear, targetMonth, targetDay, targetHour
    });
  };

  const getPickerItems = () => {
    switch(pickerType) {
      case "yearly":
        return Array.from({ length: 15 }).map((_, i) => {
          const y = new Date().getFullYear() - 2 + i;
          return { label: "年", value: y };
        });
      case "monthly":
        return Array.from({ length: 12 }).map((_, i) => ({ label: "月", value: i + 1 }));
      case "daily": {
        const daysInMonth = new Date(targetYear, targetMonth, 0).getDate();
        return Array.from({ length: daysInMonth }).map((_, i) => ({ label: "日", value: i + 1 }));
      }
      case "hourly":
        return [
          "子时 (23:00-00:59)", "丑时 (01:00-02:59)", "寅时 (03:00-04:59)", 
          "卯时 (05:00-06:59)", "辰时 (07:00-08:59)", "巳时 (09:00-10:59)", 
          "午时 (11:00-12:59)", "未时 (13:00-14:59)", "申时 (15:00-16:59)", 
          "酉时 (17:00-18:59)", "戌时 (19:00-20:59)", "亥时 (21:00-22:59)"
        ].map(h => ({
          label: "时",
          value: h,
          subtitle: h.split(' ')[1].replace(/[()]/g, '')
        }));
      default: return [];
    }
  };

  return (
    <section id="result-section" className="h-[100dvh] w-full snap-start snap-always relative overflow-hidden flex flex-col pt-8 pb-4 px-4">
      {/* HEADER & INFO */}
      <header className="flex justify-between items-start z-10 w-full mb-4 max-w-md mx-auto">
        <div className="flex flex-col gap-1.5">
          <h1 className="text-3xl font-serif-sc text-white shadow-sm leading-none" style={{ textShadow: "0 2px 10px rgba(255,255,255,0.4)" }}>Yiseen</h1>
          <div className="flex items-center gap-1.5 bg-white/10 backdrop-blur-sm rounded-full py-0.5 pr-2 pl-0.5 border border-white/20">
            <div className="w-5 h-5 rounded-full border border-white/60 bg-white/20 flex items-center justify-center shrink-0">
               <Leaf className="w-2.5 h-2.5 text-white/90" />
            </div>
            <div className="text-white/90">
              {result ? (
                <div className="flex items-baseline gap-1.5">
                  <div className="text-[11px] font-medium tracking-widest">{result.dayMaster}</div>
                  <div className="text-[9px] tracking-wider opacity-90">{result.bazi}</div>
                </div>
              ) : userInput ? (
                <div className="flex items-baseline gap-1.5">
                  <div className="text-[10px] font-medium tracking-widest">
                     {userInput.province} {userInput.city} · {userInput.gender}
                  </div>
                  <div className="text-[9px] tracking-wider opacity-90 truncate max-w-[120px]">
                     {userInput.birthYear}年{userInput.birthMonth}月{userInput.birthDay}日 {userInput.birthHour !== undefined ? `${userInput.birthHour}点` : '不明'}
                  </div>
                </div>
              ) : (
                <div className="text-[10px] tracking-widest pr-1">基础信息收录中</div>
              )}
            </div>
          </div>
        </div>
        <button
          type="button"
          onClick={onShare}
          disabled={!result || shareLoading}
          title="复制分享链接"
          className="w-8 h-8 rounded-full border border-white/40 bg-white/10 backdrop-blur-md flex items-center justify-center text-white shadow-sm mt-1 shrink-0 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {shareLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Share2 className="w-4 h-4" />}
        </button>
      </header>

      {/* MAIN CAROUSEL */}
      <div className="flex-1 min-h-0 relative z-10 w-full max-w-md mx-auto flex flex-col">
        <div className="overflow-hidden relative bg-white/70 backdrop-blur-xl border border-white/60 rounded-[2rem] shadow-xl flex-1 flex flex-col pt-6 pb-4" ref={emblaRef}>
          <div className="flex h-full">
            {/* Slide 0: Bazi Destiny Chart */}
            <div className="min-w-0 flex-[0_0_100%] px-6 flex flex-col justify-center items-center h-full">
               <div className="w-32 h-32 rounded-full border border-dashed border-[#8AAAE5]/40 flex items-center justify-center mb-8 relative">
                 <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 40, ease: "linear" }} className="absolute inset-2 border border-[#8AAAE5]/20 rounded-full" />
                 <Compass className="w-10 h-10 text-[#8AAAE5]/50" />
               </div>
               <h3 className="text-2xl font-serif-sc text-[#1E2D4A] mb-2">{result ? "时空命盘已开启" : "即将生成专属能量"}</h3>
               <p className="text-[#7F92B3] text-sm text-center leading-relaxed max-w-[200px]">
                 {result ? "向左滑动查看各周期运势，或在下方修改时间重新生成。" : "调整流年流月等目标时间，\n然后点击底部按钮生成。"}
               </p>
            </div>

            {/* Slides 1-4: The periods */}
            {periods.map((period, idx) => (
              <div key={idx} className="min-w-0 flex-[0_0_100%] px-6 flex flex-col h-full">
                 <div className="flex justify-between items-start mb-4">
                    <div>
                      <h2 className="text-2xl font-serif-sc text-[#1E2D4A] tracking-wider mb-2 font-medium">{period.data.title}</h2>
                      <div className="inline-flex items-center gap-2 text-[#7F92B3] text-sm tracking-widest font-medium">
                        <Sparkles className="w-3 h-3 text-[#B0C4DE]" />
                        {period.data.subtitle}
                        <Sparkles className="w-3 h-3 text-[#B0C4DE]" />
                      </div>
                    </div>
                    <div className="w-16 h-16 rounded-full bg-gradient-to-tr from-[#E6F0FA] to-white shadow-inner flex flex-col items-center justify-center border border-white relative shrink-0">
                       <div className="absolute inset-2 rounded-full bg-white shadow-sm flex items-center justify-center text-[#7F92B3] text-xl">
                         {period.icon}
                       </div>
                    </div>
                 </div>

                 <p className="text-[#4E5D78] text-sm leading-relaxed mb-6 whitespace-pre-wrap">{period.data.description}</p>

                 {/* Aspects Grid */}
                 <div className="grid grid-cols-2 gap-3 mb-auto">
                    {(period.data.aspects || []).map((aspect, i) => (
                      <div 
                        key={i} 
                        className="bg-white/50 border border-white/60 rounded-xl p-3 flex flex-col gap-1 cursor-pointer transition-all hover:bg-white/90 active:scale-95 shadow-sm"
                        onClick={() => setSelectedAspectInfo({ aspect, periodTitle: period.data.title })}
                      >
                        <div className="flex items-center gap-2 text-xs font-semibold text-[#1E2D4A]">
                           {icons[aspect.name as keyof typeof icons] || <Sparkles className="w-3 h-3 text-[#8AAAE5]" />}
                           {aspect.name}
                        </div>
                        <div className="text-[11px] text-[#7F92B3] ml-6">{aspect.status}</div>
                      </div>
                    ))}
                 </div>

                 <div className="border-t border-dashed border-[#B0C4DE]/40 my-4" />
                 
                 {/* Score */}
                 <div className="flex justify-between items-end pb-2">
                   <div className="flex items-baseline gap-2 text-[#4E5D78]">
                     <span className="text-xs font-medium">参考指数</span>
                     <span className="text-4xl font-serif-sc text-[#3F63A8] leading-none">{period.data.score}</span>
                     <span className="text-xs">/100</span>
                   </div>
                   <div className="w-10 h-10 rounded-full border-4 border-[#EAF2FB] border-t-[#8AAAE5] border-r-[#8AAAE5] flex items-center justify-center rotate-45 shrink-0">
                     <Sparkles className="w-3 h-3 text-[#8AAAE5] -rotate-45" />
                   </div>
                 </div>
              </div>
            ))}
          </div>

          <AnimatePresence>
            {isLoading && (
              <motion.div 
                 initial={{ opacity: 0 }}
                 animate={{ opacity: 1 }}
                 exit={{ opacity: 0 }}
                 className="absolute inset-0 bg-white/80 backdrop-blur-md z-[60] flex items-center justify-center flex-col p-6"
              >
                 <div className="relative flex items-center justify-center mb-8">
                   {/* Outer spinner */}
                   <motion.div 
                     animate={{ rotate: 360 }} 
                     transition={{ repeat: Infinity, duration: 8, ease: "linear" }} 
                     className="w-24 h-24 rounded-full border border-dashed border-[#8AAAE5] absolute opacity-40" 
                   />
                   
                   {/* Inner spinner */}
                   <motion.div 
                     animate={{ rotate: -360 }} 
                     transition={{ repeat: Infinity, duration: 12, ease: "linear" }} 
                     className="w-16 h-16 rounded-full border border-dotted border-[#DEB887] absolute opacity-60 flex items-center justify-center text-[10px] text-[#DEB887]" 
                   />
                   
                   <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#f4f7fc] to-[#eaf1fb] shadow-inner flex items-center justify-center border border-white z-10">
                     <Compass className="w-6 h-6 text-[#8AAAE5]" />
                   </div>
                 </div>
                 
                 <motion.h3 
                   initial={{ opacity: 0, y: 10 }}
                   animate={{ opacity: 1, y: 0 }}
                   transition={{ delay: 0.2 }}
                   className="text-lg font-serif-sc text-[#1E2D4A] tracking-widest mb-3"
                 >
                   正在推演星辰轨迹
                 </motion.h3>
                 
                 <motion.div 
                   initial={{ opacity: 0 }}
                   animate={{ opacity: 1 }}
                   transition={{ delay: 0.5 }}
                   className="flex items-center gap-2 text-[#7F92B3] text-xs tracking-wider"
                 >
                   <Loader2 className="w-3 h-3 animate-spin"/>
                   能量汇聚中...
                 </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Dots */}
        <div className="flex justify-center gap-2 mt-4">
          {Array.from({ length: result ? 5 : 1 }).map((_, i) => (
            <div key={i} className={`w-1.5 h-1.5 rounded-full transition-colors ${i === selectedIndex ? 'bg-[#7E96CC]' : 'bg-[#C9E0F5]'}`} />
          ))}
        </div>
      </div>

      {/* BOTTOM CONTROLS */}
      <div className="z-10 w-full max-w-md mx-auto mt-3">
        <div className="flex gap-2 justify-between mb-4">
           {[
             { id: 'yearly', label: '流年', val: `${targetYear}年`, icon: '☀️' },
             { id: 'monthly', label: '流月', val: `${targetMonth}月`, icon: '🌙' },
             { id: 'daily', label: '流日', val: `${targetDay}日`, icon: '🌟' },
             { id: 'hourly', label: '流时', val: targetHour.split(' ')[0], icon: '🕒' }
           ].map((p) => {
             return (
               <button 
                 key={p.id} 
                 onClick={() => handleOpenPicker(p.id)}
                 className={`flex-1 py-1.5 px-1 rounded-xl flex flex-col items-center justify-center transition-all bg-white/40 backdrop-blur-md border border-white/40 opacity-90 hover:bg-white/60 active:scale-95`}
               >
                 <div className="flex items-center gap-1 text-[#4E5D78]">
                   <span className="text-[10px]">{p.icon}</span>
                   <span className="text-[10px] font-serif-sc text-[#1E2D4A] tracking-widest">{p.label}</span>
                 </div>
                 <div className="text-[9px] mt-0.5 text-[#3F63A8] font-medium">{p.val}</div>
               </button>
             );
           })}
        </div>

        <button 
          onClick={handleGenerate}
          disabled={isLoading}
          className="w-full py-3.5 rounded-full bg-gradient-to-r from-[#72A2F4] to-[#88B8F8] shadow-[0_8px_20px_rgba(114,162,244,0.3)] text-white font-medium flex justify-center items-center gap-2 transition-all hover:shadow-lg disabled:opacity-70 disabled:cursor-not-allowed text-sm tracking-widest"
        >
          {isLoading ? (
             <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: "linear" }} className="flex items-center justify-center">
                <Loader2 className="w-5 h-5 text-white/80" />
             </motion.div>
          ) : (
            <>
              {result ? "更新测算" : "测算所选运势"} <Sparkles className="w-4 h-4" />
            </>
          )}
        </button>
      </div>

      {/* Basic Bottom Sheet Picker */}
      <AnimatePresence>
        {pickerOpen && (
          <motion.div 
             initial={{ opacity: 0 }}
             animate={{ opacity: 1 }}
             exit={{ opacity: 0 }}
             className="absolute inset-0 bg-black/20 backdrop-blur-sm z-50 flex items-end justify-center pb-8 px-4"
          >
             <motion.div 
               initial={{ y: "100%", opacity: 0 }}
               animate={{ y: 0, opacity: 1 }}
               exit={{ y: "100%", opacity: 0 }}
               transition={{ type: "spring", stiffness: 300, damping: 30 }}
               className="w-full max-w-sm bg-white rounded-[2rem] p-6 flex flex-col shadow-[0_-10px_40px_rgba(0,0,0,0.1)] border border-white/20"
             >
               <div className="flex justify-between items-center mb-1">
                 <h3 className="font-medium text-[#1E2D4A] tracking-wider">选择测算时期</h3>
                 <button onClick={() => setPickerOpen(false)} className="w-8 h-8 rounded-full bg-[#f2f6fc] flex items-center justify-center"><X className="text-[#7F92B3] w-4 h-4"/></button>
               </div>
               
               <ScrollPicker items={getPickerItems()} value={tempValue} onChange={setTempValue} />

               <button onClick={handleConfirmPicker} className="mt-2 w-full py-3.5 bg-[#72A2F4] text-white rounded-full font-medium tracking-widest shadow-md">
                 确 定
               </button>
             </motion.div>
          </motion.div>
        )}
        
        {/* Aspect Detail Modal */}
        {selectedAspectInfo && (
          <motion.div 
             initial={{ opacity: 0 }}
             animate={{ opacity: 1 }}
             exit={{ opacity: 0 }}
             className="absolute inset-0 bg-black/20 backdrop-blur-sm z-50 flex items-center justify-center p-6"
             onClick={() => setSelectedAspectInfo(null)}
          >
             <motion.div 
               initial={{ scale: 0.9, opacity: 0, y: 20 }}
               animate={{ scale: 1, opacity: 1, y: 0 }}
               exit={{ scale: 0.9, opacity: 0, y: 20 }}
               transition={{ type: "spring", stiffness: 300, damping: 25 }}
               onClick={(e) => e.stopPropagation()}
               className="w-full max-w-[320px] bg-white/90 backdrop-blur-xl rounded-[2rem] p-6 flex flex-col shadow-2xl border border-white"
             >
               <div className="flex justify-between items-start mb-6">
                 <div className="flex items-center gap-3">
                   <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-[#f4f7fc] to-white shadow-inner flex items-center justify-center border border-white">
                      {icons[selectedAspectInfo.aspect.name as keyof typeof icons] || <Sparkles className="w-5 h-5 text-[#8AAAE5]" />}
                   </div>
                   <div>
                     <h3 className="text-xl font-serif-sc text-[#1E2D4A] font-medium tracking-widest">
                       {selectedAspectInfo.aspect.name}
                     </h3>
                     <div className="text-[10px] text-[#7F92B3] tracking-wider">{selectedAspectInfo.periodTitle}运势</div>
                   </div>
                 </div>
                 <button onClick={() => setSelectedAspectInfo(null)} className="w-8 h-8 rounded-full bg-[#f4f7fc] text-[#7F92B3] flex items-center justify-center hover:bg-[#eaf1fb] transition-colors"><X className="w-4 h-4"/></button>
               </div>
               
               <div className="bg-[#f8fafd] rounded-2xl p-4 mb-4 border border-[#eff3f9] relative overflow-hidden">
                 <div className="absolute -right-4 -top-4 opacity-5 pointer-events-none scale-150">
                   {icons[selectedAspectInfo.aspect.name as keyof typeof icons]}
                 </div>
                 <div className="flex items-baseline gap-2 mb-3 relative z-10">
                   <div className="w-1.5 h-4 bg-[#8AAAE5] rounded-full" />
                   <div className="text-sm font-semibold text-[#3F63A8] tracking-widest">{selectedAspectInfo.aspect.status}</div>
                 </div>
                 <p className="text-sm text-[#4E5D78] leading-relaxed relative z-10 font-medium">
                   {selectedAspectInfo.aspect.detail || "暂无详细解析，请尝试重新生成或查看综合解析。"}
                 </p>
               </div>
             </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
