if (window.history.replaceState) {
    window.history.replaceState(null, null, window.location.href);
}

function preview() {
    console.log(URL.createObjectURL(event.target.files[0]));
    frame.src = URL.createObjectURL(event.target.files[0]);
    var profilePic = document.querySelector('.profile_path');
    // profilePic.value = URL.createObjectURL(event.target.files[0]);
}
function clearImage() {
    document.getElementById('formFile').value = "";
    frame.src = "./images/profiles/default.jpg";
}

function massDisplayEdit(queries, display) {
    for (i = 0; i < queries.length; i++) {
        queries[i].style.display = display;
    }
}

function nextRegisterForm() {
    const username = document.querySelector('.username');
    const password = document.querySelector('.password');
    const accounttype = document.getElementsByName('accounttype');

    // check not entered
    if (username.value == "" || password.value == "") {
        alert('Please enter required information.');
        return;
    }
    var accountTypeCheck = false;
    var accountType = null;
    for (i = 0; i < accounttype.length; i++) {
        if (accounttype[i].checked) {
            accountTypeCheck = true;
            accountType = accounttype[i];
        }
    }
    if (accountTypeCheck == false) {
        alert('Please enter required information.');
        return;
    }

    // change content of next form based on account type
    var vendorForms = document.querySelectorAll('.vendor-form');
    var customerForms = document.querySelectorAll('.customer-form');
    var shipperForms = document.querySelectorAll('.shipper-form');
    if (accountType.value == "vendor") {
        massDisplayEdit(vendorForms, 'block');
        massDisplayEdit(customerForms, 'none');
        massDisplayEdit(shipperForms, 'none');
    }
    if (accountType.value == "customer") {
        massDisplayEdit(vendorForms, 'none');
        massDisplayEdit(customerForms, 'block');
        massDisplayEdit(shipperForms, 'none');
    }
    if (accountType.value == "shipper") {
        massDisplayEdit(vendorForms, 'none');
        massDisplayEdit(customerForms, 'none');
        massDisplayEdit(shipperForms, 'block');
    }

    // validation
    if (username.value.length < 8 || username.value.length > 15 || ! /^[a-zA-Z0-9]+$/.test(username.value)) {
        alert("Username must contain only letters and digits, and and be 8-15 characters long.");
        return;
    }
    if (password.value.length < 8 || password.value.length > 20 || ! /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*])[A-Za-z\d!@#$%^&*]{8,20}$/.test(password.value)) {
        alert("Password must contain at least one uppercase letter, one lowercase letter, one digit, one special character (!@#$%^&*), and be 8-20 characters long.");
        return;
    }

    // check username exists on database
    fetch('/usernamecheck/' + username.value)
        .then(response => response.text())
        .then(data => {
            if (data == "true") {
                alert("Username exists in database, please try another username");
                return;
            }
            else {
                var register1 = document.querySelector('.register-1');
                register1.style.left = -(window.innerWidth + register1.offsetWidth) + "px";

                var register2 = document.querySelector('.register-2');
                register2.style.display = 'block';
                setTimeout(function () { register2.style.left = 0; }, 100);
            }
        });
}

function backRegisterForm() {
    var register2 = document.querySelector('.register-2');
    register2.style.left = "100vw";
    setTimeout(function () { register2.style.display = 'none'; }, 1000);

    var register1 = document.querySelector('.register-1');
    register1.style.left = 0;
}

document.addEventListener("DOMContentLoaded", function setDummyDiv() {
    if (window.location.pathname == "/signup") {
        var absoluteDivHeight = document.querySelector('.register-1').offsetHeight;
        var blankDiv = document.querySelector('.dummy');
        blankDiv.style.height = absoluteDivHeight + 'px';
    }
})

document.addEventListener("DOMContentLoaded", function setDummyDiv() {
    if (window.location.pathname != "/signup" || window.location.pathname != "/login") {
        const user = document.querySelector('.user').innerHTML.trim();
        if (user != "Guest") {
            document.querySelector('.nav-signin').style.display = "none";
            document.querySelector('.nav-signup').style.display = "none";
        }
        else {
            document.querySelector('.nav-cart').style.display = "none";
            document.querySelector('.nav-user-menu').style.display = "none";
        }
    }
})