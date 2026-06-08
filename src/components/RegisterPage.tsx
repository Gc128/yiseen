import { useState, useEffect, useRef } from "react";
import { auth, loginOrRegisterWithEmail, loginWithApple, loginWithGoogle, loginWithWechat, listenCalculations, logout, resetPassword } from "../firebase";
import { onAuthStateChanged } from "firebase/auth";
import { Apple, History, LogOut, Mail, MessageCircle, Sparkles } from "lucide-react";

type Props = {
  onSelectRecord?: (record: any) => void;
};

export default function RegisterPage({ onSelectRecord }: Props) {
  const [user, setUser] = useState<any>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [authBusy, setAuthBusy] = useState(false);
  const [authMode, setAuthMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const unsubscribeCalculationsRef = useRef<(() => void) | undefined>(undefined);

  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, (u) => {
      setUser(u);
      if (u) {
        unsubscribeCalculationsRef.current = listenCalculations(u.uid, (data) => {
          setHistory(data);
        });
      } else {
        setHistory([]);
        if (unsubscribeCalculationsRef.current) {
          unsubscribeCalculationsRef.current();
          unsubscribeCalculationsRef.current = undefined;
        }
      }
      setLoading(false);
    });
    return () => {
      unsubAuth();
      if (unsubscribeCalculationsRef.current) {
         unsubscribeCalculationsRef.current();
         unsubscribeCalculationsRef.current = undefined;
      }
    };
  }, []);

  const runAuth = async (action: () => Promise<any>, label = "登录失败") => {
    setAuthBusy(true);
    try {
      await action();
    } catch (e: any) {
      alert(`${label}：${e.message}`);
    } finally {
      setAuthBusy(false);
    }
  };

  const handleEmailAuth = async () => {
    if (!email || !password) {
      alert("请填写邮箱和密码");
      return;
    }
    if (password.length < 6) {
      alert("密码至少需要 6 位");
      return;
    }
    await runAuth(() => loginOrRegisterWithEmail(email.trim(), password, authMode), authMode === "register" ? "注册失败" : "登录失败");
  };

  const handleResetPassword = async () => {
    if (!email) {
      alert("请先填写邮箱");
      return;
    }
    await runAuth(async () => {
      await resetPassword(email.trim());
      alert("重置密码邮件已发送，请检查邮箱。");
    }, "发送失败");
  };

  const handleLogout = async () => {
    if (unsubscribeCalculationsRef.current) {
      unsubscribeCalculationsRef.current();
      unsubscribeCalculationsRef.current = undefined;
    }
    await logout();
  };

  if (loading) return null;

  return (
    <section className="h-[100dvh] w-full snap-start snap-always relative flex flex-col items-center justify-center p-6 text-center">
      <div className="w-full max-w-sm glass-box rounded-[2rem] p-8 shadow-xl flex flex-col items-center max-h-[85vh] overflow-hidden">
        {user ? (
          <div className="w-full flex flex-col h-full">
            <div className="flex justify-between items-center mb-6 shrink-0">
               <div className="flex items-center gap-3">
                 <img src={user.photoURL || `https://ui-avatars.com/api/?name=${user.email}`} alt="Avatar" className="w-10 h-10 rounded-full border border-white" />
                 <div className="text-left flex flex-col">
                   <span className="text-sm font-medium text-[#1E2D4A] tracking-wider">{user.displayName || '测算者'}</span>
                   <span className="text-[10px] text-[#7F92B3]">{user.email}</span>
                 </div>
               </div>
               <button onClick={handleLogout} className="p-2 rounded-full bg-white/50 text-[#7F92B3] hover:text-[#4E5D78] transition-colors"><LogOut className="w-4 h-4"/></button>
            </div>
            
            <div className="flex items-center gap-2 mb-4 shrink-0 text-[#3F63A8]">
              <History className="w-4 h-4" />
              <h3 className="font-medium text-sm tracking-widest">能量解析记录</h3>
            </div>
            
            <div className="flex-1 overflow-y-auto w-full space-y-3 pb-2 pr-1 custom-scrollbar">
               {history.length > 0 ? history.map(item => (
                 <div 
                    key={item.id} 
                    onClick={() => onSelectRecord && onSelectRecord(item)}
                    className="bg-white/60 border border-white/60 rounded-xl p-3 flex flex-col text-left cursor-pointer hover:bg-white/80 transition-colors"
                 >
                    <div className="flex justify-between items-center mb-2">
                       <span className="text-xs font-semibold text-[#1E2D4A] flex items-center gap-1.5"><Sparkles className="w-3 h-3 text-[#DEB887]"/> {item.dayMaster} · {item.bazi}</span>
                       <span className="text-[10px] text-[#7F92B3]">{new Date(item.createdAt).toLocaleDateString()}</span>
                    </div>
                    <div className="text-[11px] text-[#4E5D78] leading-relaxed truncate max-w-full">
                      目标时间: {item.targetYear}年{item.targetMonth ? `${item.targetMonth}月` : ''}{item.targetDay ? `${item.targetDay}日` : ''} {item.targetHour ? item.targetHour.split(' ')[0] : ''}
                    </div>
                 </div>
               )) : (
                 <div className="h-24 flex items-center justify-center text-[#A0B0C8] text-xs">暂无解析记录</div>
               )}
            </div>
          </div>
        ) : (
          <>
             <h2 className="text-2xl font-serif-sc text-[#1E2D4A] mb-2 font-medium tracking-wide">
               守护你的专属能量
             </h2>
             <p className="text-[#4E5D78] text-sm font-light mb-8">
               登录 Yiseen，保存每一次趋势解析，时刻掌控生命节奏。
             </p>
             
             <div className="w-full space-y-3">
               <button
                 onClick={() => runAuth(loginWithGoogle)}
                 disabled={authBusy}
                 className="w-full py-3 rounded-full bg-white/80 border border-white text-[#1E2D4A] font-medium shadow-sm hover:bg-white transition-all disabled:opacity-60"
               >
                 使用 Google 登录
               </button>
               <div className="grid grid-cols-2 gap-3">
                 <button
                   onClick={() => runAuth(loginWithApple, "Apple 登录失败")}
                   disabled={authBusy}
                   className="py-3 rounded-full bg-[#1E2D4A] text-white font-medium shadow-sm hover:opacity-90 transition-all disabled:opacity-60 flex items-center justify-center gap-2"
                 >
                   <Apple className="w-4 h-4" /> Apple
                 </button>
                 <button
                   onClick={() => runAuth(loginWithWechat, "微信登录失败")}
                   disabled={authBusy}
                   className="py-3 rounded-full bg-[#42B76A] text-white font-medium shadow-sm hover:opacity-90 transition-all disabled:opacity-60 flex items-center justify-center gap-2"
                 >
                   <MessageCircle className="w-4 h-4" /> 微信
                 </button>
               </div>

               <div className="pt-2 border-t border-white/70">
                 <div className="flex p-1 bg-white/40 rounded-full border border-white/60 mb-3">
                   {(["login", "register"] as const).map(mode => (
                     <button
                       key={mode}
                       type="button"
                       onClick={() => setAuthMode(mode)}
                       className={`flex-1 py-2 text-xs font-medium rounded-full transition-all ${
                         authMode === mode ? "bg-white shadow-sm text-[#4E76C9]" : "text-[#7B8B9E]"
                       }`}
                     >
                       {mode === "login" ? "邮箱登录" : "邮箱注册"}
                     </button>
                   ))}
                 </div>
                 <div className="space-y-2">
                   <input
                     value={email}
                     onChange={e => setEmail(e.target.value)}
                     type="email"
                     autoComplete="email"
                     placeholder="邮箱"
                     className="w-full bg-white/60 border border-white/50 rounded-xl py-3 px-4 text-sm text-[#2C2B36] outline-none"
                   />
                   <input
                     value={password}
                     onChange={e => setPassword(e.target.value)}
                     type="password"
                     autoComplete={authMode === "register" ? "new-password" : "current-password"}
                     placeholder="密码"
                     className="w-full bg-white/60 border border-white/50 rounded-xl py-3 px-4 text-sm text-[#2C2B36] outline-none"
                   />
                   <button
                     onClick={handleEmailAuth}
                     disabled={authBusy}
                     className="w-full py-3 rounded-full bg-gradient-to-r from-[#72A2F4] to-[#88B8F8] text-white font-medium shadow-[0_4px_15px_rgba(114,162,244,0.3)] hover:shadow-[0_6px_20px_rgba(114,162,244,0.4)] transition-all disabled:opacity-60 flex items-center justify-center gap-2"
                   >
                     <Mail className="w-4 h-4" /> {authMode === "login" ? "登录" : "注册"}
                   </button>
                   {authMode === "login" && (
                     <button onClick={handleResetPassword} disabled={authBusy} className="text-xs text-[#7F92B3] hover:text-[#3F63A8]">
                       忘记密码
                     </button>
                   )}
                 </div>
               </div>
             </div>
          </>
        )}
      </div>
    </section>
  );
}
