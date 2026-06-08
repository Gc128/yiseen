import { useState, useEffect } from "react";
import type { FormEvent } from "react";
import { motion } from "motion/react";
import { provinces } from "../data/regions";
import { UserInput } from "../types";

export default function InputPage({ 
  onCalculate
}: { 
  onCalculate: (data: UserInput) => void;
}) {
  const [gender, setGender] = useState<"男士" | "女士">("女士");
  const [birthYear, setBirthYear] = useState<number>(1998);
  const [birthMonth, setBirthMonth] = useState<number>(8);
  const [birthDay, setBirthDay] = useState<number>(21);
  const [birthHour, setBirthHour] = useState<number | undefined>(14);
  const [selectedProvince, setSelectedProvince] = useState<string>("北京市");
  const [selectedCity, setSelectedCity] = useState<string>("北京");
  const [cities, setCities] = useState<string[]>(["北京"]);

  const years = Array.from({ length: 2026 - 1950 + 1 }, (_, i) => 2026 - i);
  const months = Array.from({ length: 12 }, (_, i) => i + 1);
  const days = Array.from({ length: 31 }, (_, i) => i + 1);

  useEffect(() => {
    const prov = provinces.find((p) => p.name === selectedProvince);
    if (prov) {
      setCities(prov.cities);
      if (!prov.cities.includes(selectedCity)) {
        setSelectedCity(prov.cities[0]);
      }
    }
  }, [selectedProvince]);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    onCalculate({
      gender, birthYear, birthMonth, birthDay, birthHour, province: selectedProvince, city: selectedCity
    });
  };

  return (
    <section className="h-[100dvh] w-full snap-start snap-always flex flex-col items-center justify-center p-6 relative">
      <div className="w-full max-w-sm glass-box rounded-[2rem] p-8 shadow-xl relative z-10">
        <h2 className="text-2xl font-serif-sc text-center mb-8 text-[#2C2B36] tracking-widest font-medium">
          生辰与足迹
        </h2>
        
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Gender */}
          <div className="space-y-2">
            <label className="block text-xs font-medium text-[#7F92B3] tracking-widest pl-2">性别</label>
            <div className="flex gap-4 p-1 bg-white/40 rounded-full border border-white/60">
              {(["女士", "男士"] as const).map(g => (
                <button
                  key={g}
                  type="button"
                  onClick={() => setGender(g)}
                  className={`flex-1 py-3 text-sm font-medium rounded-full transition-all ${
                    gender === g ? "bg-white shadow-sm text-[#4E76C9]" : "text-[#7B8B9E]"
                  }`}
                >
                  {g}
                </button>
              ))}
            </div>
          </div>

          {/* Date & Hour */}
          <div className="space-y-2">
            <label className="block text-xs font-medium text-[#7F92B3] tracking-widest pl-2">出生时间</label>
            <div className="grid grid-cols-3 gap-3 mb-3">
               <div className="relative">
                  <select className="w-full bg-white/60 border border-white/50 rounded-xl py-3 px-2 text-sm text-[#2C2B36] font-medium appearance-none outline-none" value={birthYear} onChange={e => setBirthYear(Number(e.target.value))}>
                    {years.map(y => <option key={y} value={y}>{y}年</option>)}
                  </select>
               </div>
               <div className="relative">
                  <select className="w-full bg-white/60 border border-white/50 rounded-xl py-3 px-2 text-sm text-[#2C2B36] font-medium appearance-none outline-none" value={birthMonth} onChange={e => setBirthMonth(Number(e.target.value))}>
                    {months.map(m => <option key={m} value={m}>{m}月</option>)}
                  </select>
               </div>
               <div className="relative">
                  <select className="w-full bg-white/60 border border-white/50 rounded-xl py-3 px-2 text-sm text-[#2C2B36] font-medium appearance-none outline-none" value={birthDay} onChange={e => setBirthDay(Number(e.target.value))}>
                    {days.map(d => <option key={d} value={d}>{d}日</option>)}
                  </select>
               </div>
            </div>

            <div className="relative">
              <select className="w-full bg-white/60 border border-white/50 rounded-xl py-3 px-4 text-sm text-[#2C2B36] font-medium appearance-none outline-none" value={birthHour === undefined ? -1 : birthHour} onChange={e => setBirthHour(Number(e.target.value) === -1 ? undefined : Number(e.target.value))}>
                <option value={-1}>时辰未知</option>
                {Array.from({length: 24}).map((_, i) => (
                  <option key={i} value={i}>{i < 10 ? `0${i}` : i}:00</option>
                ))}
              </select>
            </div>
          </div>

          {/* Location */}
          <div className="space-y-2">
            <label className="block text-xs font-medium text-[#7F92B3] tracking-widest pl-2">出生地点</label>
            <div className="grid grid-cols-2 gap-3">
               <div className="relative">
                  <select className="w-full bg-white/60 border border-white/50 rounded-xl py-3 px-3 text-sm text-[#2C2B36] font-medium appearance-none outline-none" value={selectedProvince} onChange={e => setSelectedProvince(e.target.value)}>
                    {provinces.map(p => <option key={p.name} value={p.name}>{p.name}</option>)}
                  </select>
               </div>
               <div className="relative">
                  <select className="w-full bg-white/60 border border-white/50 rounded-xl py-3 px-3 text-sm text-[#2C2B36] font-medium appearance-none outline-none" value={selectedCity} onChange={e => setSelectedCity(e.target.value)}>
                    {cities.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
               </div>
            </div>
          </div>

          <button
            type="submit"
            className="w-full mt-4 py-4 rounded-full bg-gradient-to-br from-[#77A9EE] to-[#8FBBF3] text-white font-medium tracking-widest shadow-md hover:shadow-lg transition-all flex justify-center items-center gap-2"
          >
            下一步
          </button>
        </form>
      </div>
    </section>
  );
}
