import { useAuthStore } from "@/store/authStore";
import { useNavigate, useLocation } from "react-router-dom";
import { useCallback, useEffect, useState } from "react";
import { useStackApp } from "@stackframe/react";
import { Button } from "@/components/ui/button";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Eye, EyeOff, Github } from "lucide-react";

import githubIcon from "@/assets/github.svg";
import { proxyFetchPost } from "@/api/http";
import { hasStackKeys } from "@/lib";

const HAS_STACK_KEYS = hasStackKeys();
let lock = false;
export default function Login() {
	const app = HAS_STACK_KEYS ? useStackApp() : null;
	const { setAuth,setModelType } = useAuthStore();
	const navigate = useNavigate();
	const location = useLocation();
	const [hidePassword, setHidePassword] = useState(true);

	const [formData, setFormData] = useState({
		email: "",
		password: "",
	});
	const [errors, setErrors] = useState({
		email: "",
		password: "",
	});
	const [isLoading, setIsLoading] = useState(false);
	const [generalError, setGeneralError] = useState("");

	const validateEmail = (email: string) => {
		const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
		return emailRegex.test(email);
	};

	const validateForm = () => {
		const newErrors = {
			email: "",
			password: "",
		};

		if (!formData.email) {
			newErrors.email = "Please enter email address";
		} else if (!validateEmail(formData.email)) {
			newErrors.email = "Please enter a valid email address";
		}

		if (!formData.password) {
			newErrors.password = "Please enter password";
		} else if (formData.password.length < 6) {
			newErrors.password = "Password must be at least 6 characters";
		}

		setErrors(newErrors);
		return !newErrors.email && !newErrors.password;
	};

	const handleInputChange = (field: string, value: string) => {
		setFormData((prev) => ({
			...prev,
			[field]: value,
		}));

		if (errors[field as keyof typeof errors]) {
			setErrors((prev) => ({
				...prev,
				[field]: "",
			}));
		}

		if (generalError) {
			setGeneralError("");
		}
	};

	//
	const handleLogin = async () => {
		if (!validateForm()) {
			return;
		}

		setGeneralError("");
		setIsLoading(true);
		try {
			const data = await proxyFetchPost("/api/login", {
				email: formData.email,
				password: formData.password,
			});

			if (data.code === 10) {
				setGeneralError(data.text || "Login failed, please try again");
				return;
			}

			setAuth({ email: formData.email, ...data });
			setModelType('cloud')
			navigate("/");
		} catch (error: any) {
			console.error("Login failed:", error);
			setGeneralError("Login failed, please check your email and password");
		} finally {
			setIsLoading(false);
		}
	};

	const handleLoginByStack = async (token: string) => {
		try {
			const data = await proxyFetchPost("/api/login-by_stack?token=" + token, {
				token: token,
			});

			if (data.code === 10) {
				setGeneralError(data.text || "Login failed, please try again");
				return;
			}
			console.log("data", data);
			setModelType('cloud')
			setAuth({ email: formData.email, ...data });
			navigate("/");
		} catch (error: any) {
			console.error("Login failed:", error);
			setGeneralError("Login failed, please check your email and password");
		} finally {
			setIsLoading(false);
		}
	};

	const handleReloadBtn = async (type: string) => {
		console.log("handleReloadBtn1", type);
		const cookies = document.cookie.split("; ");
		cookies.forEach((cookie) => {
			const [name] = cookie.split("=");
			if (name.startsWith("stack-oauth-outer-")) {
				document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/`;
			}
		});
		console.log("handleReloadBtn2", type);
		await app.signInWithOAuth(type);
	};

	const handleGetToken = async (code: string) => {
		const code_verifier = localStorage.getItem("stack-oauth-outer-");
		const formData = new URLSearchParams();
		console.log(
			"import.meta.env.PROD",
			import.meta.env.PROD
				? `${import.meta.env.VITE_BASE_URL}/api/redirect/callback`
				: `${import.meta.env.VITE_PROXY_URL}/api/redirect/callback`
		);
		formData.append(
			"redirect_uri",
			import.meta.env.PROD
				? `${import.meta.env.VITE_BASE_URL}/api/redirect/callback`
				: `${import.meta.env.VITE_PROXY_URL}/api/redirect/callback`
		);
		formData.append("code_verifier", code_verifier || "");
		formData.append("code", code);
		formData.append("grant_type", "authorization_code");
		formData.append("client_id", "aa49cdd0-318e-46bd-a540-0f1e5f2b391f");
		formData.append(
			"client_secret",
			"pck_t13egrd9ve57tz52kfcd2s4h1zwya5502z43kr5xv5cx8"
		);

		try {
			const res = await fetch(
				"https://api.stack-auth.com/api/v1/auth/oauth/token",
				{
					method: "POST",
					headers: {
						"Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
					},
					body: formData,
				}
			);
			const data = await res.json(); // parse response data
			return data.access_token;
		} catch (error) {
			console.error(error);
			setIsLoading(false);
		}
	};

	const handleAuthCode = useCallback(
		async (event: any, code: string) => {
			if (lock || location.pathname !== "/login") return;

			lock = true;
			setIsLoading(true);
			let accessToken = await handleGetToken(code);
			handleLoginByStack(accessToken);
			setTimeout(() => {
				lock = false;
			}, 1500);
		},
		[location.pathname]
	);

	useEffect(() => {
		window.ipcRenderer?.on("auth-code-received", handleAuthCode);

		return () => {
			window.ipcRenderer?.off("auth-code-received", handleAuthCode);
		};
	}, []);

	return (
		<div className={`p-2 flex items-center justify-center gap-2 h-full`}>
			<div className="flex items-center justify-center h-[calc(800px-16px)] rounded-3xl bg-gradient-to-br from-blue-50 to-indigo-100">
				<div className="text-gray-400 text-center p-8">
					<div className="text-6xl mb-4">🔐</div>
					<div className="text-xl font-semibold">Welcome to Eigent</div>
				</div>
			</div>
			<div className="h-full flex-1 flex flex-col items-center justify-center">
				<div className="flex-1 flex flex-col items-center justify-center">
					<div className="w-80">
						<div className="h-[46px] relative text-[#27272A] font-inter text-[36px]  font-bold leading-[46px]">
							Login
							<span
								onClick={() => navigate("/signup")}
								className="absolute bottom-0 right-0 text-[#27272A] font-inter text-[13px]  font-normal leading-5 cursor-pointer"
							>
								Sign Up
							</span>
						</div>
						{HAS_STACK_KEYS && (
							<div className="w-full pt-6">
								<Button
									variant="primary"
									size="lg"
									onClick={() => handleReloadBtn("google")}
									className="w-full rounded-[24px] mb-4 transition-all duration-300 ease-in-out text-[#F5F5F5] text-center font-inter text-[15px] font-bold leading-[22px] justify-center"
									disabled={isLoading}
								>
									<div className="w-5 h-5 flex items-center justify-center">
									<svg viewBox="0 0 24 24" className="w-full h-full" fill="currentColor">
										<path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
										<path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
										<path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
										<path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
									</svg>
								</div>
									<span className="ml-2">Continue with Google</span>
								</Button>
								<Button
									variant="primary"
									size="lg"
									onClick={() => handleReloadBtn("github")}
									className="w-full rounded-[24px] mb-4 transition-all duration-300 ease-in-out text-[#F5F5F5] text-center font-inter text-[15px] font-bold leading-[22px] justify-center"
									disabled={isLoading}
								>
									<img src={githubIcon} className="w-5 h-5" />
									<span className="ml-2">Continue with Github</span>
								</Button>
							</div>
						)}
						{HAS_STACK_KEYS && (
							<div className="mt-2 w-full text-[#222] text-center font-inter text-[15px]  font-medium leading-[22px] mb-6">
								or
							</div>
						)}
						<div className="w-full">
							{generalError && (
								<p className="text-red-500 text-sm mt-0.5 mb-4">
									{generalError}
								</p>
							)}
							<div className="w-full mb-4 relative">
								<Label
									htmlFor="email"
									className="inline-block text-[#222] font-inter text-[13px]  font-bold leading-5 h-5 mb-1.5"
								>
									Email
								</Label>
								<div className="relative">
									<Input
										id="email"
										type="email"
										placeholder="Enter your email"
										required
										value={formData.email}
										onChange={(e) => handleInputChange("email", e.target.value)}
										className={`rounded border border-[#CCC] bg-white shadow-none text-[13px] text-input-text-focus font-normal ${
											errors.email ? "border-red-500" : ""
										}`}
									/>
								</div>
								{errors.email && (
									<p className="text-red-500 text-sm mt-0.5">{errors.email}</p>
								)}
							</div>
							<div className="w-full mb-1.5 relative">
								<div className="flex items-center">
									<Label
										htmlFor="password"
										className="inline-block text-[#222] font-inter text-[13px] font-bold leading-5 h-5 mb-1.5"
									>
										Password
									</Label>
								</div>

								<div className="relative">
									<div
										className="cursor-pointer w-6 h-6 absolute top-0 bottom-0 m-auto right-1.5"
										onClick={() => {
											setHidePassword(!hidePassword);
										}}
									>
										{hidePassword ? <Eye className="w-5 h-5" /> : <EyeOff className="w-5 h-5" />}
									</div>
									<Input
										id="password"
										type={hidePassword ? "password" : "text"}
										required
										placeholder="Enter your password"
										value={formData.password}
										onChange={(e) =>
											handleInputChange("password", e.target.value)
										}
										className={`rounded border border-[#CCC] bg-white shadow-none text-[13px] text-input-text-focus font-normal pr-9 ${
											errors.password ? "border-red-500" : ""
										}`}
									/>
								</div>
								{errors.password && (
									<p className="text-red-500 text-sm mt-0.5">
										{errors.password}
									</p>
								)}
							</div>
						</div>
						<Button
							onClick={handleLogin}
							size="lg"
							variant="ghost"
							type="submit"
							className="w-full rounded-[24px] mt-4 bg-white-100% text-[#222] text-center transition-all duration-300 ease-in-out font-inter text-[15px]  font-bold leading-[22px] hover:bg-white-80%"
							disabled={isLoading}
						>
							<span className="flex-1">
								{isLoading ? "Logging in..." : "Log In"}
							</span>
						</Button>
					</div>
				</div>

				<div className="text-text-body text-xs font-medium leading-tight">
					Privacy Policy
				</div>
			</div>
		</div>
	);
}
