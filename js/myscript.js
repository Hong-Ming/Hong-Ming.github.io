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

var Aid = null;
var Offset;
var TopOffset
function SmoothScrollToAnchorFix(ID) {
  var NavHeight = 45;
  var TopViewMargin = 10;
  var Elemt = document.getElementById(ID);
  var EleOffset = Math.round(Elemt.offsetTop);
  var MarginTop = Math.round(parseFloat(window.getComputedStyle(Elemt, null).getPropertyValue("padding-top")));
  TopOffset = Math.round(window.scrollY || document.documentElement.scrollTop || document.body.scrollTop);
  Offset = TopOffset - EleOffset + NavHeight + TopViewMargin - MarginTop;
  if (ID == "myhom") {
    Offset = Offset - TopViewMargin;
  }
  cancelAnimationFrame(Aid);
  SmoothScrollUD();
}

function SmoothScrollUD() {
  var ScrollAmt;
  if (Offset > 0) {
    ScrollAmt = Math.min(150, Math.ceil(Offset / 5));
    window.scrollTo(0, TopOffset-ScrollAmt);
    Offset = Offset - ScrollAmt;
    TopOffset = TopOffset - ScrollAmt;
    Aid = requestAnimationFrame(SmoothScrollUD);
  } else if (Offset < 0) {
    ScrollAmt = Math.max(-150, Math.floor(Offset / 5));
    window.scrollTo(0, TopOffset-ScrollAmt);
    Offset = Offset - ScrollAmt;
    TopOffset = TopOffset - ScrollAmt;
    Aid = requestAnimationFrame(SmoothScrollUD);
  }
}

function SmoothScrollToTop() {
  TopOffset = Math.round(window.scrollY || document.documentElement.scrollTop || document.body.scrollTop);
  Offset = Math.ceil(TopOffset / 25);
  cancelAnimationFrame(Aid);
  SmoothScroll();
}
function SmoothScroll() {
  if (TopOffset > 0) {
    ScrollAmt = Math.min(TopOffset, Offset);
    window.scrollTo(0, TopOffset-ScrollAmt);
    TopOffset = TopOffset - ScrollAmt;
    Aid = requestAnimationFrame(SmoothScroll);
  }
}
