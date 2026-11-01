(function(root){
  'use strict';
  const endpoint='https://script.google.com/macros/s/AKfycbzfHH1FZClKHemKs3p_dbiFEIMJBu58_DgFVf5LSjF9vGsVLwvEfPbBqJ2ZCGonKTW0/exec';
  async function read(params){
    const url=new URL(endpoint);Object.entries(params).forEach(([key,value])=>url.searchParams.set(key,value));url.searchParams.set('_',String(Date.now()));
    const response=await fetch(url,{credentials:'omit',cache:'no-store',redirect:'follow',signal:AbortSignal.timeout(20000)});
    if(!response.ok)throw Error('Unable to reach the church. Please try again.');
    const data=await response.json();if(!data||data.ok!==true)throw Error('Unable to load sign-ups. Please try again.');return data;
  }
  root.PBC_SIGNUPS={
    events:async()=>{const data=await read({signupApi:'events'});if(!Array.isArray(data.events))throw Error('Unable to load sign-ups.');return data.events;},
    submit:async payload=>{
      // Check first when retrying. Never infer success from an opaque POST response.
      try{if((await read({signupApi:'receipt',signupId:payload.signupId})).received===true)return {success:true};}catch(error){}
      try{await fetch(endpoint,{method:'POST',mode:'no-cors',credentials:'omit',body:new URLSearchParams({signupPayload:JSON.stringify(payload)}),signal:AbortSignal.timeout(25000)});}catch(error){}
      for(let attempt=0;attempt<4;attempt++){
        if(attempt)await new Promise(resolve=>setTimeout(resolve,1500));
        try{if((await read({signupApi:'receipt',signupId:payload.signupId})).received===true)return {success:true};}catch(error){}
      }
      throw Error('We could not confirm your sign-up. Your entries are still here. Try again to check or resend safely, or contact the church.');
    }
  };
})(window);
