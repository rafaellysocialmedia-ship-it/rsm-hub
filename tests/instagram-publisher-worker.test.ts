import { test } from "node:test";
import assert from "node:assert/strict";
// @ts-ignore: standalone ESM Cloudflare Worker intentionally has no TypeScript declaration
import publisher from "../workers/instagram-publisher-staging.mjs";

const envBase = { RSM_ENVIRONMENT:"staging", SUPABASE_URL:"https://dtladsjhmnzdxcmgivne.supabase.co",
  RSM_PUBLISH_ENABLED:"true", SUPABASE_SERVICE_ROLE_KEY:"test-service-key" };
const original = globalThis.fetch;
const guid = "11111111-1111-4111-8111-111111111111";
const postId = "22222222-2222-4222-8222-222222222222";
const keyBytes = new Uint8Array(32).fill(7);
const encodedKey = Buffer.from(keyBytes).toString("base64");
async function ciphertext(plain: string) {
  const key = await crypto.subtle.importKey("raw",keyBytes,"AES-GCM",false,["encrypt"]);
  const iv = new Uint8Array(12).fill(2);
  const data = await crypto.subtle.encrypt({name:"AES-GCM",iv},key,new TextEncoder().encode(plain));
  return JSON.stringify({version:1,iv:Buffer.from(iv).toString("base64"),
    data:Buffer.from(data).toString("base64")});
}
async function event(env: Record<string,string>) {
  let pending: Promise<unknown> = Promise.resolve();
  await publisher.scheduled({},env,{waitUntil(p:Promise<unknown>){pending=p;}});
  await pending;
}
test("cron refuses missing flags and production destination without issuing requests", async () => {
  let calls=0; globalThis.fetch = async () => { calls++; throw Error("must never run"); };
  try {
    await event({...envBase,RSM_PUBLISH_ENABLED:"false"});
    await event({...envBase,RSM_ENVIRONMENT:"production"});
    await event({...envBase,SUPABASE_URL:"https://zttgcamgixlkbkbdvrtb.supabase.co"});
  } catch (error) {
    assert.match(String(error),/staging_configuration_invalid/);
  } finally {globalThis.fetch=original;}
  assert.equal(calls,0);
});
test("cron signs private JPEG, publishes once, records Meta ID and confirms RSM status",async()=>{
  let jobStatus="queued";
  let postStatus="scheduled";
  const steps:string[]=[];
  const encrypted=await ciphertext("test-instagram-token");
  globalThis.fetch=async (input,init)=>{
    const url=new URL(String(input));
    const body=String(init?.body??"");
    steps.push(url.pathname);
    if(url.pathname.endsWith("/rpc/claim_due_instagram_publish_job"))
      return Response.json(jobStatus==="queued"||jobStatus==="prepared"
        ? [{job_id:guid,post_id:postId,phase:jobStatus==="queued"?"create":"check",
          instagram_user_id:"17890000000000",encrypted_access_token:encrypted,
          storage_path:"2026/post.jpg",caption:"<p>Legenda &amp; hashtag</p>",creation_id:jobStatus==="prepared"?"987654321":null}] : []);
    if(url.pathname==="/storage/v1/object/sign/post-files/2026/post.jpg") {
      assert.ok(!body.includes("test-instagram-token"));
      return Response.json({signedURL:"/object/sign/post-files/2026/post.jpg?token=dummy-signed"});
    }
    if(url.pathname==="/v24.0/17890000000000/media") {
      assert.equal(new URLSearchParams(body).get("caption"),"Legenda & hashtag");
      assert.equal(new URLSearchParams(body).get("image_url"),
        "https://dtladsjhmnzdxcmgivne.supabase.co/storage/v1/object/sign/post-files/2026/post.jpg?token=dummy-signed");
      return Response.json({id:"987654321"});
    }
    if(url.pathname==="/v24.0/987654321") return Response.json({status_code:"FINISHED"});
    if(url.pathname==="/v24.0/17890000000000/media_publish")
      return Response.json({id:"111222333"});
    if(url.pathname==="/rest/v1/instagram_publish_jobs") {
      const query=url.searchParams.get("status")!.replace("eq.","");
      assert.equal(jobStatus==="queued"||jobStatus==="prepared" ? "processing" : jobStatus,query);
      jobStatus=JSON.parse(body).status;
      if(jobStatus==="published") assert.equal(JSON.parse(body).published_media_id,"111222333");
      return Response.json([{id:guid}]);
    }
    if(url.pathname==="/rest/v1/posts") {
      if(init?.method==="GET") return Response.json([{social_network:"Instagram",social_networks:["Instagram"]}]);
      postStatus=JSON.parse(body).status;
      return Response.json([{id:postId,status:postStatus}]);
    }
    throw Error("Unexpected mock request");
  };
  try {
    await event({...envBase,INSTAGRAM_TOKEN_ENCRYPTION_KEY:encodedKey});
    assert.equal(jobStatus,"published");
    assert.equal(postStatus,"published");
    assert.equal(steps.filter(s=>s.endsWith("/media_publish")).length,1);
    await event({...envBase,INSTAGRAM_TOKEN_ENCRYPTION_KEY:encodedKey});
    assert.equal(steps.filter(s=>s.endsWith("/media_publish")).length,1);
  } finally {globalThis.fetch=original;}
});
test("uncertain Instagram publish response never triggers automatic duplicate",async()=>{
  let state="prepared";
  let calls=0;
  const encrypted=await ciphertext("test-instagram-token");
  globalThis.fetch=async(input,init)=>{
    const url=new URL(String(input));
    if(url.pathname.endsWith("/rpc/claim_due_instagram_publish_job"))
      return Response.json(state==="prepared" ? [{job_id:guid,post_id:postId,phase:"check",
        instagram_user_id:"17890000000000",encrypted_access_token:encrypted,
        creation_id:"987654321",storage_path:"sample/post.jpg",caption:"Test"}]:[]);
    if(url.pathname==="/v24.0/987654321") return Response.json({status_code:"FINISHED"});
    if(url.pathname.endsWith("/media_publish")) {calls++;return Response.json({error:"simulated"}, {status:503});}
    if(url.pathname==="/rest/v1/instagram_publish_jobs") {
      const previous=url.searchParams.get("status")!.replace("eq.","");
      assert.equal(state==="prepared" ? "processing":state,previous);
      state=JSON.parse(String(init?.body)).status;
      return Response.json([{id:guid}]);
    }
    throw Error("Unexpected request: "+url.pathname);
  };
  try{
    await event({...envBase,INSTAGRAM_TOKEN_ENCRYPTION_KEY:encodedKey});
    assert.equal(state,"uncertain");
    await event({...envBase,INSTAGRAM_TOKEN_ENCRYPTION_KEY:encodedKey});
    assert.equal(calls,1);
  }finally{globalThis.fetch=original;}
});
