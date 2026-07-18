export function printLabels(printRef) {
  if (!printRef?.current) return;

  const content = printRef.current.innerHTML;

  const win = window.open(
    "",
    "_blank",
    "width=900,height=700"
  );

  if (!win) return;

  win.document.write(`
<!DOCTYPE html>
<html>
<head>
<title>Vertice Etiket</title>

<style>

body{

margin:20px;
font-family:Arial,Helvetica,sans-serif;
background:white;

}

img{

max-width:100%;

}

.grid{

display:grid;
grid-template-columns:repeat(2,1fr);
gap:20px;

}

</style>

</head>

<body>

${content}

<script>

window.onload=()=>{

window.print();

window.onafterprint=()=>window.close();

}

</script>

</body>

</html>

`);

  win.document.close();
}
