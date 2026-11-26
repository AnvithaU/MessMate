import React, { useState } from "react";
import { useAuth } from "../../context/AuthContext";
import {
  Lock,
  Mail,
  Eye,
  EyeOff,
  ArrowRight,
  AlertCircle,
  User as UserIcon,
  Phone,
  DoorOpen,
  Check,
  X,
  Loader2,
} from "lucide-react";

type AuthMode = "login" | "register";

interface FieldErrors {
  fullName?: string;
  studentId?: string;
  course?: string;
  customDepartment?: string;
  roomNumber?: string;
  email?: string;
  phone?: string;
  password?: string;
  confirmPassword?: string;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const STUDENT_DOMAINS = ["@nmamit.in", "@student.nmamit.in"];
const ADMIN_DOMAINS = ["@admin.nmamit.in", "@warden.nmamit.in"];
const STAFF_DOMAINS = ["@staff.nmamit.in"];

function hasDomain(email: string, domains: string[]): boolean {
  const lower = email.trim().toLowerCase();
  return domains.some((d) => lower.endsWith(d));
}

function getPasswordChecks(pw: string) {
  return [
    { label: "At least 8 characters", met: pw.length >= 8 },
    { label: "One uppercase letter (A-Z)", met: /[A-Z]/.test(pw) },
    { label: "One lowercase letter (a-z)", met: /[a-z]/.test(pw) },
    { label: "One number (0-9)", met: /[0-9]/.test(pw) },
    { label: "One special character (!@#$%^&*)", met: /[^A-Za-z0-9]/.test(pw) },
  ];
}

function getPasswordStrength(pw: string): number {
  const checks = getPasswordChecks(pw);
  const metCount = checks.filter((c) => c.met).length;
  if (pw.length === 0) return 0;
  if (metCount <= 2) return 1;
  if (metCount === 3) return 2;
  if (metCount === 4) return 3;
  return 4;
}

const STRENGTH_COLORS = ["transparent", "#dc2626", "#d97706", "#52796F", "#C5A059"];
const STRENGTH_LABELS = ["", "Weak", "Fair", "Good", "Strong"];

export const Login: React.FC = () => {
  const { login, register } = useAuth();
  const [mode, setMode] = useState<AuthMode>("login");

  // Shared fields
  const [email, setEmail] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [showPassword, setShowPassword] = useState<boolean>(false);

  // Register-only fields
  const [fullName, setFullName] = useState<string>("");
  const [studentId, setStudentId] = useState<string>("");
  const [course, setCourse] = useState<string>("B.Tech");
  const [department, setDepartment] = useState<string>("Computer Science & Engineering");
  const [customDepartment, setCustomDepartment] = useState<string>("");
  const [roomNumber, setRoomNumber] = useState<string>("");
  const [phone, setPhone] = useState<string>("");
  const [confirmPassword, setConfirmPassword] = useState<string>("");
  const [showConfirm, setShowConfirm] = useState<boolean>(false);
  const [pwFocused, setPwFocused] = useState<boolean>(false);

  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const switchMode = (next: AuthMode) => {
    setMode(next);
    setFieldErrors({});
    setErrorMsg(null);
    setPassword("");
    setConfirmPassword("");
  };

  const validateLogin = (): boolean => {
    const errs: FieldErrors = {};
    const trimmedEmail = email.trim().toLowerCase();

    if (!trimmedEmail) {
      errs.email = "Email address is required.";
    } else if (!EMAIL_RE.test(trimmedEmail)) {
      errs.email = "Enter a valid email address (e.g. you@nmamit.in).";
    } else if (
      !hasDomain(trimmedEmail, [
        ...STUDENT_DOMAINS,
        ...ADMIN_DOMAINS,
        ...STAFF_DOMAINS,
      ])
    ) {
      errs.email = "Please enter a valid @nmamit.in or registered hostel email address.";
    }

    if (!password) {
      errs.password = "Password is required.";
    }

    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const validateRegister = (): boolean => {
    const errs: FieldErrors = {};
    const trimmedEmail = email.trim().toLowerCase();
    const trimmedName = fullName.trim();
    const cleanId = studentId.trim().toUpperCase();
    const cleanRoom = roomNumber.trim().toUpperCase();

    if (!trimmedName) {
      errs.fullName = "Full name is required.";
    } else if (trimmedName.length < 2) {
      errs.fullName = "Full name must be at least 2 characters.";
    }

    if (!cleanId) {
      errs.studentId = "USN / Roll No is required.";
    } else if (!/^[A-Z0-9]{5,18}$/.test(cleanId)) {
      errs.studentId = "USN must be 5–18 alphanumeric characters (e.g. NNM22CS001).";
    }

    if (department === "Others" && customDepartment.trim().length < 2) {
      errs.customDepartment = "Please enter your department name.";
    }

    if (!cleanRoom) {
      errs.roomNumber = "Hostel room number is required (e.g. B-304).";
    } else if (cleanRoom.length < 2 || cleanRoom.length > 12) {
      errs.roomNumber = "Enter a valid room number (e.g. B-304).";
    }

    if (!trimmedEmail) {
      errs.email = "Student email is required.";
    } else if (!EMAIL_RE.test(trimmedEmail)) {
      errs.email = "Enter a valid email address.";
    } else if (!hasDomain(trimmedEmail, STUDENT_DOMAINS)) {
      errs.email = "Student registration requires an official @nmamit.in email address.";
    }

    if (phone.trim() && !/^[0-9+\-\s]{7,15}$/.test(phone.trim())) {
      errs.phone = "Enter a valid 10-digit phone number.";
    }

    const checks = getPasswordChecks(password);
    const failedChecks = checks.filter((c) => !c.met);
    if (!password) {
      errs.password = "Password is required.";
    } else if (failedChecks.length > 0) {
      errs.password = `Missing: ${failedChecks.map((c) => c.label.toLowerCase()).join(", ")}.`;
    }

    if (!confirmPassword) {
      errs.confirmPassword = "Please confirm your password.";
    } else if (confirmPassword !== password) {
      errs.confirmPassword = "Passwords do not match.";
    }

    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (mode === "login") {
      if (!validateLogin()) return;
      setSubmitting(true);
      try {
        await login(email.trim().toLowerCase(), password);
      } catch (err: any) {
        setErrorMsg(err.message || "Authentication failed. Please check your credentials.");
      } finally {
        setSubmitting(false);
      }
    } else {
      if (!validateRegister()) return;
      setSubmitting(true);
      const resolvedDepartment =
        department === "Others" ? customDepartment.trim() : department;
      try {
        await register({
          fullName: fullName.trim(),
          studentId: studentId.trim().toUpperCase(),
          email: email.trim().toLowerCase(),
          password,
          course,
          department: resolvedDepartment,
          roomNumber: roomNumber.trim().toUpperCase(),
          semester: 1,
          phone: phone.trim() || undefined,
        });
      } catch (err: any) {
        setErrorMsg(err.message || "Registration failed. Please check your details.");
      } finally {
        setSubmitting(false);
      }
    }
  };

  const pwChecks = getPasswordChecks(password);
  const strength = getPasswordStrength(password);

  const inputStyle = (hasErr?: string): React.CSSProperties => ({
    background: "white",
    border: hasErr ? "1.5px solid #dc2626" : "1px solid rgba(82,121,111,0.25)",
    color: "var(--obsidian)",
    boxShadow: "0 1px 3px rgba(8,28,21,0.04)",
  });

  return (
    <div
      className="min-h-screen w-full flex flex-col lg:flex-row relative overflow-hidden font-sans"
      style={{ background: "var(--obsidian)" }}
    >
      {/* Ambient glows */}
      <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden">
        <div
          className="absolute -top-40 -left-40 w-[480px] h-[480px] rounded-full blur-3xl"
          style={{ background: "rgba(82,121,111,0.12)" }}
        />
        <div
          className="absolute -bottom-40 -right-20 w-[400px] h-[400px] rounded-full blur-3xl"
          style={{ background: "rgba(197,160,89,0.09)" }}
        />
        <div
          className="absolute top-1/2 left-1/3 -translate-y-1/2 w-[700px] h-[700px] rounded-full border pointer-events-none"
          style={{ borderColor: "rgba(197,160,89,0.06)" }}
        />
        <div
          className="absolute top-1/2 left-1/3 -translate-y-1/2 w-[1000px] h-[1000px] rounded-full border pointer-events-none"
          style={{ borderColor: "rgba(197,160,89,0.03)" }}
        />
      </div>

      {/* Left — Brand Column */}
      <div
        className="relative z-10 lg:w-[44%] p-10 sm:p-14 lg:p-20 flex flex-col justify-between border-b lg:border-b-0 lg:border-r"
        style={{ borderColor: "rgba(197,160,89,0.1)" }}
      >
        <div>
          <div className="flex items-center gap-3.5 mb-10">
            <img
              src="/messmate-n-emblem.png"
              alt="MessMate Emblem"
              className="h-12 w-auto object-contain filter drop-shadow flex-shrink-0"
              onError={(e) => {
                (e.currentTarget as HTMLElement).style.display = "none";
              }}
            />
            <div className="flex flex-col justify-center leading-tight">
              <span className="font-serif text-2xl font-bold tracking-widest text-[#FAF8F5]">
                MESS<span style={{ color: "var(--gold)" }}>MATE</span>
              </span>
              <span className="block text-[10px] tracking-widest uppercase font-semibold" style={{ color: "rgba(197,160,89,0.85)" }}>
                NMAMIT Hostels
              </span>
            </div>
          </div>

          <div
            className="inline-block px-3 py-1 rounded-full text-[10px] font-semibold uppercase tracking-widest mb-5 border"
            style={{
              background: "rgba(197,160,89,0.08)",
              color: "var(--gold-light)",
              borderColor: "rgba(197,160,89,0.2)",
            }}
          >
            Nitte Deemed to be University
          </div>

          <h1 className="text-4xl sm:text-5xl font-serif font-light leading-tight mb-5" style={{ color: "var(--alabaster)" }}>
            Hostel Dining
            <br />
            <em className="italic font-normal" style={{ color: "var(--gold-light)" }}>
              Management System
            </em>
          </h1>

          <p className="text-sm leading-relaxed max-w-sm mb-10" style={{ color: "rgba(250,248,245,0.6)" }}>
            N.M.A.M. Institute of Technology&apos;s centralised platform for monthly mess enrolment,
            add-on scheduling, QR-based meal redemption, and hostel leave rebates.
          </p>

          <div className="flex flex-col gap-3 max-w-sm">
            {[
              ["Monthly Enrolment", "South & North Mess — choose once per month"],
              ["Universal QR Wallet", "One permanent QR for all meals & add-ons"],
              ["Hostel Leave Rebates", "50% back for 4+ days, 100% for 8+ days"],
              ["Advance Ledger", "Transparent advance payments & semester-end refunds"],
            ].map(([title, desc]) => (
              <div key={title} className="flex items-start gap-3">
                <div className="w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0" style={{ background: "var(--gold)" }} />
                <div>
                  <span className="text-xs font-semibold block" style={{ color: "var(--alabaster)" }}>
                    {title}
                  </span>
                  <span className="text-[11px]" style={{ color: "rgba(250,248,245,0.5)" }}>
                    {desc}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div
          className="pt-10 text-[10px] flex items-center justify-between"
          style={{ color: "rgba(250,248,245,0.3)", borderTop: "1px solid rgba(197,160,89,0.1)" }}
        >
          <span>NMAMIT Hostel Mess Portal</span>
          <span>MessMate v2</span>
        </div>
      </div>

      {/* Right — Auth Card */}
      <div
        className="relative z-10 lg:w-[56%] p-6 sm:p-12 lg:p-16 flex items-center justify-center overflow-y-auto"
        style={{ background: "var(--alabaster)" }}
      >
        <div className="w-full max-w-md space-y-5 my-auto">
          <div>
            <p
              className="text-[11px] font-bold uppercase tracking-widest mb-1 flex items-center gap-1.5"
              style={{ color: "var(--olive)" }}
            >
              <Lock className="w-3.5 h-3.5" />
              NMAMIT Hostels
            </p>
            <h2 className="font-serif text-3xl font-bold" style={{ color: "var(--obsidian)" }}>
              {mode === "login" ? "Welcome back" : "Create Student Account"}
            </h2>
            <p className="text-xs mt-1" style={{ color: "rgba(8,28,21,0.55)" }}>
              {mode === "login"
                ? "Sign in with your registered email and password."
                : "Register using your official @nmamit.in student email address."}
            </p>
          </div>

          {/* Auth Mode Tabs */}
          <div
            className="grid grid-cols-2 p-1 rounded-xl"
            style={{ background: "rgba(8,28,21,0.06)", border: "1px solid rgba(82,121,111,0.15)" }}
          >
            <button
              type="button"
              onClick={() => switchMode("login")}
              className="py-2 rounded-lg text-xs font-bold transition-all"
              style={{
                background: mode === "login" ? "var(--obsidian)" : "transparent",
                color: mode === "login" ? "var(--gold-light)" : "rgba(8,28,21,0.55)",
              }}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => switchMode("register")}
              className="py-2 rounded-lg text-xs font-bold transition-all"
              style={{
                background: mode === "register" ? "var(--obsidian)" : "transparent",
                color: mode === "register" ? "var(--gold-light)" : "rgba(8,28,21,0.55)",
              }}
            >
              Create Account
            </button>
          </div>

          {errorMsg && (
            <div
              className="p-3.5 rounded-xl flex items-start gap-2.5 text-xs"
              style={{
                background: "rgba(220,38,38,0.06)",
                border: "1px solid rgba(220,38,38,0.22)",
                color: "#b91c1c",
              }}
            >
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} noValidate className="space-y-3.5">
            {mode === "register" && (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] font-bold uppercase tracking-wider block mb-1.5" style={{ color: "rgba(8,28,21,0.7)" }}>
                      Full Name
                    </label>
                    <div className="relative">
                      <UserIcon className="w-4 h-4 absolute left-3 top-3 pointer-events-none" style={{ color: "rgba(8,28,21,0.3)" }} />
                      <input
                        type="text"
                        value={fullName}
                        onChange={(e) => {
                          setFullName(e.target.value);
                          if (fieldErrors.fullName) setFieldErrors((f) => ({ ...f, fullName: undefined }));
                        }}
                        placeholder="Aarav Sharma"
                        className="w-full pl-9 pr-3 py-2.5 rounded-xl text-xs font-medium focus:outline-none transition-all"
                        style={inputStyle(fieldErrors.fullName)}
                      />
                    </div>
                    {fieldErrors.fullName && (
                      <p className="text-[11px] mt-1 font-medium text-red-600">{fieldErrors.fullName}</p>
                    )}
                  </div>

                  <div>
                    <label className="text-[11px] font-bold uppercase tracking-wider block mb-1.5" style={{ color: "rgba(8,28,21,0.7)" }}>
                      USN / Roll No
                    </label>
                    <input
                      type="text"
                      value={studentId}
                      onChange={(e) => {
                        setStudentId(e.target.value.toUpperCase());
                        if (fieldErrors.studentId) setFieldErrors((f) => ({ ...f, studentId: undefined }));
                      }}
                      placeholder="NNM22CS001"
                      className="w-full px-3.5 py-2.5 rounded-xl text-xs font-medium uppercase focus:outline-none transition-all"
                      style={inputStyle(fieldErrors.studentId)}
                    />
                    {fieldErrors.studentId && (
                      <p className="text-[11px] mt-1 font-medium text-red-600">{fieldErrors.studentId}</p>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] font-bold uppercase tracking-wider block mb-1.5" style={{ color: "rgba(8,28,21,0.7)" }}>
                      Course
                    </label>
                    <select
                      value={course}
                      onChange={(e) => setCourse(e.target.value)}
                      className="w-full px-3 py-2.5 rounded-xl text-xs font-medium focus:outline-none"
                      style={inputStyle()}
                    >
                      <option value="B.Tech">B.Tech</option>
                      <option value="BBA">BBA</option>
                      <option value="MBA">MBA</option>
                      <option value="MCA">MCA</option>
                      <option value="M.Tech">M.Tech</option>
                      <option value="B.Arch">B.Arch</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-[11px] font-bold uppercase tracking-wider block mb-1.5" style={{ color: "rgba(8,28,21,0.7)" }}>
                      Hostel Room No
                    </label>
                    <div className="relative">
                      <DoorOpen className="w-4 h-4 absolute left-3 top-3 pointer-events-none" style={{ color: "rgba(8,28,21,0.3)" }} />
                      <input
                        type="text"
                        value={roomNumber}
                        onChange={(e) => {
                          setRoomNumber(e.target.value.toUpperCase());
                          if (fieldErrors.roomNumber) setFieldErrors((f) => ({ ...f, roomNumber: undefined }));
                        }}
                        placeholder="B-304"
                        className="w-full pl-9 pr-3 py-2.5 rounded-xl text-xs font-medium uppercase focus:outline-none"
                        style={inputStyle(fieldErrors.roomNumber)}
                      />
                    </div>
                    {fieldErrors.roomNumber && (
                      <p className="text-[11px] mt-1 font-medium text-red-600">{fieldErrors.roomNumber}</p>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] font-bold uppercase tracking-wider block mb-1.5" style={{ color: "rgba(8,28,21,0.7)" }}>
                      Department
                    </label>
                    <select
                      value={department}
                      onChange={(e) => {
                        setDepartment(e.target.value);
                        if (fieldErrors.customDepartment) {
                          setFieldErrors((f) => ({ ...f, customDepartment: undefined }));
                        }
                      }}
                      className="w-full px-3 py-2.5 rounded-xl text-xs font-medium focus:outline-none"
                      style={inputStyle()}
                    >
                      <option>Computer Science &amp; Engineering</option>
                      <option>Information Science &amp; Engineering</option>
                      <option>Electronics &amp; Communication</option>
                      <option>Mechanical Engineering</option>
                      <option>Civil Engineering</option>
                      <option>Artificial Intelligence &amp; ML</option>
                      <option>Biotechnology</option>
                      <option>Business Administration</option>
                      <option value="Others">Others</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-[11px] font-bold uppercase tracking-wider block mb-1.5" style={{ color: "rgba(8,28,21,0.7)" }}>
                      Phone (Optional)
                    </label>
                    <div className="relative">
                      <Phone className="w-4 h-4 absolute left-3 top-3 pointer-events-none" style={{ color: "rgba(8,28,21,0.3)" }} />
                      <input
                        type="tel"
                        value={phone}
                        onChange={(e) => {
                          setPhone(e.target.value);
                          if (fieldErrors.phone) setFieldErrors((f) => ({ ...f, phone: undefined }));
                        }}
                        placeholder="+91 98765 43210"
                        className="w-full pl-9 pr-3 py-2.5 rounded-xl text-xs font-medium focus:outline-none"
                        style={inputStyle(fieldErrors.phone)}
                      />
                    </div>
                    {fieldErrors.phone && (
                      <p className="text-[11px] mt-1 font-medium text-red-600">{fieldErrors.phone}</p>
                    )}
                  </div>
                </div>

                {department === "Others" && (
                  <div>
                    <label className="text-[11px] font-bold uppercase tracking-wider block mb-1.5" style={{ color: "rgba(8,28,21,0.7)" }}>
                      Specify Department
                    </label>
                    <input
                      type="text"
                      value={customDepartment}
                      onChange={(e) => {
                        setCustomDepartment(e.target.value);
                        if (fieldErrors.customDepartment) {
                          setFieldErrors((f) => ({ ...f, customDepartment: undefined }));
                        }
                      }}
                      placeholder="Enter your department name"
                      className="w-full px-3.5 py-2.5 rounded-xl text-xs font-medium focus:outline-none"
                      style={inputStyle(fieldErrors.customDepartment)}
                    />
                    {fieldErrors.customDepartment && (
                      <p className="text-[11px] mt-1 font-medium text-red-600">{fieldErrors.customDepartment}</p>
                    )}
                  </div>
                )}
              </>
            )}

            {/* Email */}
            <div>
              <label className="text-[11px] font-bold uppercase tracking-wider block mb-1.5" style={{ color: "rgba(8,28,21,0.7)" }}>
                Email Address
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 absolute left-3.5 top-3.5 pointer-events-none" style={{ color: "rgba(8,28,21,0.3)" }} />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (fieldErrors.email) setFieldErrors((f) => ({ ...f, email: undefined }));
                  }}
                  placeholder="you@nmamit.in"
                  className="w-full pl-10 pr-4 py-3 rounded-xl text-sm font-medium focus:outline-none transition-all"
                  style={inputStyle(fieldErrors.email)}
                />
              </div>
              {fieldErrors.email && (
                <p className="text-[11px] mt-1.5 font-medium text-red-600 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3 flex-shrink-0" />
                  {fieldErrors.email}
                </p>
              )}
            </div>

            {/* Password */}
            <div>
              <label className="text-[11px] font-bold uppercase tracking-wider block mb-1.5" style={{ color: "rgba(8,28,21,0.7)" }}>
                Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 absolute left-3.5 top-3.5 pointer-events-none" style={{ color: "rgba(8,28,21,0.3)" }} />
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onFocus={() => setPwFocused(true)}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (fieldErrors.password) setFieldErrors((f) => ({ ...f, password: undefined }));
                  }}
                  placeholder="••••••••••••"
                  className="w-full pl-10 pr-11 py-3 rounded-xl text-sm font-medium focus:outline-none transition-all"
                  style={inputStyle(fieldErrors.password)}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-3.5 transition-colors"
                  style={{ color: "rgba(8,28,21,0.35)" }}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {fieldErrors.password && (
                <p className="text-[11px] mt-1.5 font-medium text-red-600 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3 flex-shrink-0" />
                  {fieldErrors.password}
                </p>
              )}

              {/* Live Password Strength Meter & Requirements Checklist */}
              {mode === "register" && (pwFocused || password.length > 0) && (
                <div
                  className="mt-2.5 p-3 rounded-xl space-y-2"
                  style={{ background: "rgba(255,255,255,0.85)", border: "1px solid rgba(82,121,111,0.18)" }}
                >
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="font-semibold" style={{ color: "rgba(8,28,21,0.6)" }}>
                      Password Strength
                    </span>
                    {strength > 0 && (
                      <span className="font-bold" style={{ color: STRENGTH_COLORS[strength] }}>
                        {STRENGTH_LABELS[strength]}
                      </span>
                    )}
                  </div>
                  <div className="grid grid-cols-4 gap-1.5">
                    {[1, 2, 3, 4].map((seg) => (
                      <div
                        key={seg}
                        className="h-1.5 rounded-full transition-all"
                        style={{
                          background: strength >= seg ? STRENGTH_COLORS[strength] : "rgba(8,28,21,0.08)",
                        }}
                      />
                    ))}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1 pt-1">
                    {pwChecks.map((chk) => (
                      <div
                        key={chk.label}
                        className="flex items-center gap-1.5 text-[11px]"
                        style={{ color: chk.met ? "#2e7d32" : "rgba(8,28,21,0.5)" }}
                      >
                        {chk.met ? (
                          <Check className="w-3 h-3 flex-shrink-0 text-emerald-600" />
                        ) : (
                          <X className="w-3 h-3 flex-shrink-0 text-slate-400" />
                        )}
                        <span>{chk.label}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Confirm Password (Register mode) */}
            {mode === "register" && (
              <div>
                <label className="text-[11px] font-bold uppercase tracking-wider block mb-1.5" style={{ color: "rgba(8,28,21,0.7)" }}>
                  Confirm Password
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 absolute left-3.5 top-3.5 pointer-events-none" style={{ color: "rgba(8,28,21,0.3)" }} />
                  <input
                    type={showConfirm ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(e) => {
                      setConfirmPassword(e.target.value);
                      if (fieldErrors.confirmPassword)
                        setFieldErrors((f) => ({ ...f, confirmPassword: undefined }));
                    }}
                    placeholder="Re-enter password"
                    className="w-full pl-10 pr-11 py-3 rounded-xl text-sm font-medium focus:outline-none transition-all"
                    style={inputStyle(fieldErrors.confirmPassword)}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirm(!showConfirm)}
                    className="absolute right-3.5 top-3.5 transition-colors"
                    style={{ color: "rgba(8,28,21,0.35)" }}
                  >
                    {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {fieldErrors.confirmPassword && (
                  <p className="text-[11px] mt-1.5 font-medium text-red-600 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3 flex-shrink-0" />
                    {fieldErrors.confirmPassword}
                  </p>
                )}
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2.5 mt-2 transition-all disabled:opacity-70"
              style={{
                background: submitting
                  ? "var(--olive)"
                  : "linear-gradient(135deg, var(--obsidian) 0%, var(--obsidian-mid) 100%)",
                color: "var(--gold-light)",
                boxShadow: "0 4px 16px -4px rgba(8,28,21,0.35)",
                letterSpacing: "0.04em",
              }}
            >
              {submitting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <ArrowRight className="w-4 h-4" />
              )}
              <span>
                {submitting
                  ? mode === "login"
                    ? "Signing In..."
                    : "Creating Account..."
                  : mode === "login"
                  ? "Sign In"
                  : "Create Student Account"}
              </span>
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
