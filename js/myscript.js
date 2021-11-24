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
var Exp_Offset = 0;
var Counter;
var NavHeight;
function SmoothScrollToAnchorFix(ID) {
  IdName = ID;
  Counter = 0;
  NavHeight = 45;
  cancelAnimationFrame(Aid);
  SmoothScrollUD();
}

function SmoothScrollToAnchor(ID) {
  IdName = ID;
  Counter = 0;
  NavHeight = 0;
  cancelAnimationFrame(Aid);
  SmoothScrollUD();
}

function SmoothScrollUD() {
  var Elemt = document.getElementById(IdName);
  var EleOffset = Elemt.offsetTop;
  var MarginTop = parseFloat(window.getComputedStyle(Elemt, null).getPropertyValue("padding-top"));
  var TopOffset = window.pageYOffset || document.documentElement.scrollTop || document.body.scrollTop;
  // var NavHeight = 45;
  var TopViewMargin = 10;
  var Offset = TopOffset - EleOffset + NavHeight + TopViewMargin - MarginTop;
  if (IdName == "myhom") {
    Offset = Offset - TopViewMargin;
  }
  if (Counter < 10 || Math.abs(Offset - Exp_Offset) < 5) {
    var ScrollAmt;
    if (Offset > 0) {
      ScrollAmt = Math.min(100, Math.ceil(Offset / 5));
      window.scrollBy(0, -ScrollAmt);
      Exp_Offset = Offset - ScrollAmt;
      Aid = requestAnimationFrame(SmoothScrollUD);
    } else if (Offset < 0) {
      ScrollAmt = Math.max(-100, Math.floor(Offset / 5));
      window.scrollBy(0, -ScrollAmt);
      Exp_Offset = Offset - ScrollAmt;
      Aid = requestAnimationFrame(SmoothScrollUD);
    }
    Counter = Counter + 1;
  }
}

var ScrollInterval;
function SmoothScrollToTop() {
  var duration = 0.5;
  Counter = 0;
  ScrollInterval = Math.ceil((window.pageYOffset || document.documentElement.scrollTop || document.body.scrollTop) / (duration * 60));
  cancelAnimationFrame(Aid);
  SmoothScroll();
}
function SmoothScroll() {
  var Offset = window.pageYOffset || document.documentElement.scrollTop || document.body.scrollTop;
  if (Counter < 5 || Math.abs(Offset - Exp_Offset) < 5) {
    if (Offset > 0) {
      window.scrollBy(0, -Math.min(Offset, ScrollInterval));
      Exp_Offset = Offset - ScrollInterval;
      Aid = requestAnimationFrame(SmoothScroll);
    }
    Counter = Counter + 1;
  }
}
