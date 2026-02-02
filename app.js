const modal = document.getElementById("patronModal");
const openBtn = document.getElementById("openPatron");
const closeBtn = document.getElementById("btnClosePatron");
const validateBtn = document.getElementById("btnValidatePatron");
const errorBox = document.getElementById("patronError");

const CODE_PATRON = "1234"; // modifiable

openBtn.onclick = () => {
  modal.classList.remove("hidden");
  errorBox.textContent = "";
};

closeBtn.onclick = () => {
  modal.classList.add("hidden");
  document.getElementById("patronCode").value = "";
};

validateBtn.onclick = () => {
  const val = document.getElementById("patronCode").value;
  if(val === CODE_PATRON){
    modal.classList.add("hidden"); // fermeture OK
    document.getElementById("patronCode").value = "";
    alert("Mode patron activé");
  }else{
    errorBox.textContent = "Code incorrect";
  }
};

// clic hors fenêtre = fermeture
modal.addEventListener("click", (e)=>{
  if(e.target === modal){
    modal.classList.add("hidden");
  }
});
