function topnavFunction() {
    var element = document.getElementById("myDropdown");
    element.classList.toggle("show");
}
window.onclick = function(e) {
  if (!e.target.matches('.dropbtn')) {
  var myDropdown = document.getElementById("myDropdown");
    if (myDropdown.classList.contains('show')) {
      myDropdown.classList.remove('show');
    }
  }
}

jQuery(document).ready(function () {
  var duration = 500;
  jQuery('.back-to-top').click(function (event) {
    event.preventDefault();
    jQuery('html, body').animate({ scrollTop: 0 }, duration);
    return false;
  })
});