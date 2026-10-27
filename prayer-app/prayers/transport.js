(function(root){
  'use strict';
  const endpoint='https://script.google.com/macros/s/AKfycbzfHH1FZClKHemKs3p_dbiFEIMJBu58_DgFVf5LSjF9vGsVLwvEfPbBqJ2ZCGonKTW0/exec';
  async function read(params){
    const url=new URL(endpoint);Object.entries(params).forEach(([k,v])=>url.searchParams.set(k,v));url.searchParams.set('_',String(Date.now()));
    const response=await fetch(url,{credentials:'omit',cache:'no-store',redirect:'follow',signal:AbortSignal.timeout(20000)});
    if(!response.ok)throw Error('Unable to reach the church. Please try again.');
    const data=await response.json();if(!data||data.ok!==true)throw Error('Unable to load the church prayer information. Please try again.');return data;
  }
  root.PBC_HUB_API={
    list:async()=>{const data=await read({hubApi:'list'});if(!Array.isArray(data.prayers))throw Error('Unable to load prayer list.');return data.prayers;},
    submit:async payload=>{
      // An opaque no-cors response alone cannot confirm delivery. Verify the receipt.
      let posted=false;
      try{await fetch(endpoint,{method:'POST',mode:'no-cors',credentials:'omit',body:new URLSearchParams({hubPayload:JSON.stringify(payload)}),signal:AbortSignal.timeout(25000)});posted=true;}catch(error){}
      for(let attempt=0;attempt<4;attempt++){
        if(attempt)await new Promise(resolve=>setTimeout(resolve,1500));
        try{if((await read({hubApi:'receipt',changeId:payload.changeId})).received===true)return {success:true};}catch(error){}
      }
      throw Error(posted?'We could not confirm receipt. Your entries are still here; try again or contact the church.':'The connection was interrupted. Your entries are still here; please try again.');
    }
  };
})(window);
