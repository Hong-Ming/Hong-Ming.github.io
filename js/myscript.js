function topnavFunction() {
  var element = document.getElementById("myDropdown");
  element.classList.toggle("show");
}
window.onclick = function (e) {
  if (!e.target.matches(".dropbtn")) {
    var myDropdown = document.getElementById("myDropdown");
    if (myDropdown.classList.contains("show")) {
      myDropdown.classList.remove("show");
    }
  }
};

var IdName;
var Aid = null;
var Next_Offset = 0;
var First;
var Counter;
function SmoothScrollToAnchor(ID) {
  IdName = ID;
  First = true;
  Counter = 0;
  cancelAnimationFrame(Aid);
  SmoothScrollUD();
}

function SmoothScrollUD() {
  var Elemt = document.getElementById(IdName);
  var EleOffset = Elemt.offsetTop;
  var MarginTop = parseFloat(
    window.getComputedStyle(Elemt, null).getPropertyValue("padding-top")
  );
  var TopOffset =
    window.pageYOffset ||
    document.documentElement.scrollTop ||
    document.body.scrollTop;
  var TopViewMargin = 20;
  var Offset = TopOffset - EleOffset - TopViewMargin - MarginTop;
  if (IdName == "myhom") {
    Offset = Offset + TopViewMargin;
  }
  
  // if (First || Offset == Next_Offset){
  if (Counter < 10 || Offset == Next_Offset){
    var ScrollAmt;
    if (Offset > 0) {
      ScrollAmt = Math.min(100, Math.ceil(Offset / 5))
      window.scrollBy(0, -ScrollAmt);
      Next_Offset = Offset - ScrollAmt;
      Aid = requestAnimationFrame(SmoothScrollUD);
    } 
    else if (Offset < 0) {
      ScrollAmt = Math.max(-100, Math.floor(Offset / 5));
      window.scrollBy(0, -ScrollAmt);
      Next_Offset = Offset - ScrollAmt;
      Aid = requestAnimationFrame(SmoothScrollUD);
    }
    First = false;
    Counter = Counter + 1;
  }
}

var ScrollInterval;
function SmoothScrollToTop() {
  var duration = 0.5;
  First = true;
  ScrollInterval = Math.ceil((window.pageYOffset ||
    document.documentElement.scrollTop ||
    document.body.scrollTop) / (duration*60)); 
  cancelAnimationFrame(Aid);
  SmoothScroll();
}
function SmoothScroll() {
  var Offset =
    window.pageYOffset ||
    document.documentElement.scrollTop ||
    document.body.scrollTop;
  if (First || Offset == Next_Offset){
    if (Offset > 0) {
      window.scrollBy(0, -Math.min(Offset,ScrollInterval));
      Next_Offset = Offset - ScrollInterval;
      Aid = requestAnimationFrame(SmoothScroll);
    } 
    First = false;
  }
}
