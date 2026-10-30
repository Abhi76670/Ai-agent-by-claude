Apps that keep user data must persist it in localStorage.
- Wrap every read/write in try/catch and render correctly when storage is empty.
- Pattern: const [x,setX]=React.useState(()=>{try{return JSON.parse(localStorage.getItem('app_x'))||init}catch(e){return init}}); React.useEffect(()=>{try{localStorage.setItem('app_x',JSON.stringify(x))}catch(e){}},[x]);
- Prefix keys with the app name. Show a friendly empty state.
