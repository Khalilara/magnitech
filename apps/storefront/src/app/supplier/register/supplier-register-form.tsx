"use client";

import { useState } from "react";
import Link from "next/link";
import { readJsonResponse } from "@/lib/api-response";

export default function SupplierRegisterForm(){
  const [busy,setBusy]=useState(false),[error,setError]=useState(""),[success,setSuccess]=useState("");
  async function submit(event:React.FormEvent<HTMLFormElement>){event.preventDefault();setBusy(true);setError("");const form=new FormData(event.currentTarget);if(form.get("password")!==form.get("confirmPassword")){setError("The passwords do not match.");setBusy(false);return}try{const response=await fetch("/api/auth/supplier-register",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(Object.fromEntries(form.entries()))});const result=await readJsonResponse<{error?:string;message?:string}>(response);if(!response.ok)throw new Error(result.error??"Could not submit your application.");setSuccess(result.message??"Your application was received and is pending review.");event.currentTarget.reset()}catch(reason){setError(reason instanceof Error?reason.message:"Could not submit your application.")}finally{setBusy(false)}}
  if(success)return <div className="supplier-success" role="status"><b>Application received</b><p>{success}</p><Link className="button dark-button" href="/supplier/login">Go to supplier sign in <span>↗</span></Link></div>;
  return <form className="auth-form supplier-register-form" onSubmit={submit}>
    <label>Email<input name="email" type="email" autoComplete="email" maxLength={254} required/></label>
    <div className="auth-form-row"><label>Company name<input name="companyName" maxLength={160} required/></label><label>Phone<input name="phone" type="tel" maxLength={40} required/></label></div>
    <label>Business address<textarea name="businessAddress" rows={2} maxLength={500} required/></label>
    <div className="auth-form-row"><label>Business registration <small>Optional</small><input name="businessRegistration" maxLength={120}/></label></div>
    <div className="auth-form-row"><label>Password<input name="password" type="password" autoComplete="new-password" maxLength={128} required/></label><label>Confirm password<input name="confirmPassword" type="password" autoComplete="new-password" maxLength={128} required/></label></div>
    {error&&<p className="auth-error" role="alert">{error}</p>}<button className="supplier-send-button" disabled={busy}>{busy?"Sending…":"Send"}</button><p className="login-admin-note">Your application stays pending until an administrator reviews it. No supplier access is granted on submission.</p>
  </form>;
}

